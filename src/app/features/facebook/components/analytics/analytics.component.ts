import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookAnalyticsService } from '../../services/facebook-analytics.service';
import { FacebookGroupsService } from '../../services/facebook-groups.service';
import { FacebookPage, FacebookGroup, ChartMetricSeries, PageMetricsResponse, GroupMetricsResponse, PageSnapshot, GroupSnapshot } from '../../models/facebook.model';

interface PageWithMetrics extends FacebookPage {
  chartData?: {
    labels: string[];
    series: ChartMetricSeries[];
  };
  loadingMetrics?: boolean;
  selected?: boolean;
  snapshot?: PageSnapshot;
  loadingSnapshot?: boolean;
}

interface GroupWithMetrics extends FacebookGroup {
  chartData?: {
    labels: string[];
    series: ChartMetricSeries[];
  };
  loadingMetrics?: boolean;
  selected?: boolean;
  snapshot?: GroupSnapshot;
  loadingSnapshot?: boolean;
}

type CategoryType = 'pages' | 'groups';
type ViewType = 'overview' | 'detailed';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  // Sidebar y categorías
  activeCategory: CategoryType = 'pages';

  // Vista activa (overview o detailed)
  activeView: ViewType = 'overview';

  // Páginas
  pages: PageWithMetrics[] = [];
  selectedPage: PageWithMetrics | null = null;
  loadingPages = true;
  errorPages: string | null = null;

  // Grupos
  groups: GroupWithMetrics[] = [];
  selectedGroup: GroupWithMetrics | null = null;
  loadingGroups = false;
  errorGroups: string | null = null;

  // Sincronización (solo para páginas)
  syncing = false;
  syncProgress: string = '';

  // Fechas por defecto: últimos 30 días
  fromDate: string = this.getDateString(-30);
  toDate: string = this.getDateString(0);

  // Configuración de ECharts
  chartOptions: echarts.EChartsOption = {};

  // Métricas disponibles para páginas
  availablePageMetrics = [
    { key: 'page_fans', label: 'Fans', color: '#3d79ee' },
    { key: 'page_followers', label: 'Seguidores', color: '#10b981' },
    { key: 'page_follows', label: 'Nuevos Seguidores', color: '#10b981' },
    { key: 'page_reach', label: 'Alcance', color: '#f59e0b' },
    { key: 'page_impressions', label: 'Impresiones', color: '#ef4444' },
    { key: 'page_impressions_unique', label: 'Alcance Único', color: '#ef4444' },
    { key: 'page_engaged_users', label: 'Usuarios que interactuaron', color: '#8b5cf6' },
    { key: 'page_post_engagements', label: 'Engagement total', color: '#ec4899' }
  ];

  // Métricas disponibles para grupos
  availableGroupMetrics = [
    { key: 'member_count', label: 'Miembros', color: '#3d79ee' },
    { key: 'post_count', label: 'Publicaciones', color: '#10b981' },
    { key: 'engagement', label: 'Interacciones', color: '#f59e0b' }
  ];

  selectedMetricKeys: string[] = ['page_impressions_unique', 'page_follows', 'page_post_engagements'];

  private subscriptions = new Subscription();

  constructor(
    private facebookService: FacebookOAuthService,
    private analyticsService: FacebookAnalyticsService,
    private groupsService: FacebookGroupsService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Obtiene las métricas disponibles según la categoría activa
   */
  get availableMetrics() {
    return this.activeCategory === 'pages' ? this.availablePageMetrics : this.availableGroupMetrics;
  }

  /**
   * Obtiene el estado de carga según la categoría activa
   */
  get loading() {
    return this.activeCategory === 'pages' ? this.loadingPages : this.loadingGroups;
  }

  /**
   * Obtiene el error según la categoría activa
   */
  get error() {
    return this.activeCategory === 'pages' ? this.errorPages : this.errorGroups;
  }

  ngOnInit(): void {
    // Leer parámetro de categoría desde query params
    this.route.queryParams.subscribe(params => {
      const category = params['category'];
      if (category === 'groups') {
        this.activeCategory = 'groups';
        if (this.groups.length === 0) {
          this.loadGroups();
        }
        // Si hay grupos y estamos en vista detallada y no hay seleccionado, seleccionar el primero
        if (this.groups.length > 0 && this.activeView === 'detailed' && !this.selectedGroup) {
          this.selectedGroup = this.groups[0];
          this.selectedGroup.selected = true;
          this.loadMetricsForGroup(this.selectedGroup);
        }
      } else {
        this.activeCategory = 'pages';
        if (this.pages.length === 0) {
          this.loadPages();
        }
        // Si hay páginas y estamos en vista detallada y no hay seleccionada, seleccionar la primera
        if (this.pages.length > 0 && this.activeView === 'detailed' && !this.selectedPage) {
          this.selectedPage = this.pages[0];
          this.selectedPage.selected = true;
          this.loadMetricsForPage(this.selectedPage);
        }
      }
    });

    // Cargar ambos para tener los contadores disponibles (pero solo mostrar el activo)
    this.loadPages();
    this.loadGroups();
  }

  /**
   * Cambia la categoría activa (páginas o grupos)
   */
  switchCategory(category: CategoryType): void {
    if (this.activeCategory === category) {
      return;
    }

    this.activeCategory = category;

    // Actualizar URL con query params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category },
      queryParamsHandling: 'merge'
    });

    // Resetear métricas seleccionadas según la categoría
    if (category === 'pages') {
      this.selectedMetricKeys = ['page_impressions_unique', 'page_follows', 'page_post_engagements'];
      if (this.selectedPage) {
        this.loadMetricsForPage(this.selectedPage);
      } else if (this.pages.length > 0) {
        this.selectedPage = this.pages[0];
        this.selectedPage.selected = true;
        this.loadMetricsForPage(this.selectedPage);
      }
    } else {
      this.selectedMetricKeys = ['member_count', 'post_count'];
      if (this.selectedGroup) {
        this.loadMetricsForGroup(this.selectedGroup);
      } else if (this.groups.length > 0) {
        this.selectedGroup = this.groups[0];
        this.selectedGroup.selected = true;
        this.loadMetricsForGroup(this.selectedGroup);
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Obtiene una fecha en formato yyyy-MM-dd
   */
  private getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Carga las páginas conectadas
   */
  loadPages(): void {
    this.loadingPages = true;
    this.errorPages = null;

    const pagesSubscription = this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        this.pages = pages
          .filter(page => page.isActive)
          .map(page => ({ ...page, selected: false, loadingSnapshot: true }));

        // Cargar snapshots para todas las páginas
        this.loadSnapshotsForPages();

        if (this.pages.length > 0 && this.activeCategory === 'pages' && this.activeView === 'detailed') {
          this.selectedPage = this.pages[0];
          this.selectedPage.selected = true;
          this.loadMetricsForPage(this.selectedPage);
        }

        this.loadingPages = false;
      },
      error: (error) => {
        this.errorPages = error.message || 'Error al cargar las páginas';
        this.loadingPages = false;
        console.error('Error al cargar páginas:', error);
      }
    });

    this.subscriptions.add(pagesSubscription);
  }

  /**
   * Carga los snapshots para todas las páginas activas
   */
  private loadSnapshotsForPages(): void {
    this.pages.forEach((page, index) => {
      if (page.isActive) {
        this.loadPageSnapshot(page, index);
      } else {
        page.loadingSnapshot = false;
      }
    });
  }

  /**
   * Carga el snapshot de una página específica
   */
  private loadPageSnapshot(page: PageWithMetrics, index: number): void {
    const snapshotSubscription = this.analyticsService.getPageSnapshot(page.facebookPageId).subscribe({
      next: (response) => {
        this.pages[index].snapshot = response.data;
        this.pages[index].loadingSnapshot = false;
      },
      error: (error) => {
        // Si no hay snapshot (404), no es un error crítico
        if (error.message.includes('404') || error.message.includes('No se encontraron')) {
          this.pages[index].snapshot = undefined;
        } else {
          console.error(`Error al cargar snapshot para ${page.name}:`, error);
        }
        this.pages[index].loadingSnapshot = false;
      }
    });

    this.subscriptions.add(snapshotSubscription);
  }

  /**
   * Carga los grupos conectados
   */
  loadGroups(): void {
    this.loadingGroups = true;
    this.errorGroups = null;

    const groupsSubscription = this.groupsService.getGroups().subscribe({
      next: (response) => {
        this.groups = response.data
          .filter(group => group.isActive)
          .map(group => ({ ...group, selected: false, loadingSnapshot: true }));

        // Cargar snapshots para todos los grupos
        this.loadSnapshotsForGroups();

        if (this.groups.length > 0 && this.activeCategory === 'groups' && this.activeView === 'detailed') {
          this.selectedGroup = this.groups[0];
          this.selectedGroup.selected = true;
          this.loadMetricsForGroup(this.selectedGroup);
        }

        this.loadingGroups = false;
      },
      error: (error) => {
        this.errorGroups = error.message || 'Error al cargar los grupos';
        this.loadingGroups = false;
        console.error('Error al cargar grupos:', error);
      }
    });

    this.subscriptions.add(groupsSubscription);
  }

  /**
   * Carga los snapshots para todos los grupos activos
   */
  private loadSnapshotsForGroups(): void {
    this.groups.forEach((group, index) => {
      if (group.isActive) {
        this.loadGroupSnapshot(group, index);
      } else {
        group.loadingSnapshot = false;
      }
    });
  }

  /**
   * Carga el snapshot de un grupo específico
   */
  private loadGroupSnapshot(group: GroupWithMetrics, index: number): void {
    const snapshotSubscription = this.groupsService.getGroupSnapshot(group.facebookGroupId).subscribe({
      next: (response) => {
        this.groups[index].snapshot = response.data;
        this.groups[index].loadingSnapshot = false;
      },
      error: (error) => {
        // Si no hay snapshot (404), no es un error crítico
        if (error.message.includes('404') || error.message.includes('No se encontraron')) {
          this.groups[index].snapshot = undefined;
        } else {
          console.error(`Error al cargar snapshot para ${group.name}:`, error);
        }
        this.groups[index].loadingSnapshot = false;
      }
    });

    this.subscriptions.add(snapshotSubscription);
  }

  /**
   * Selecciona una página y carga sus métricas
   */
  selectPage(page: PageWithMetrics): void {
    this.pages.forEach(p => p.selected = false);
    page.selected = true;
    this.selectedPage = page;
    this.loadMetricsForPage(page);
  }

  /**
   * Carga las métricas de una página para el rango de fechas seleccionado
   */
  loadMetricsForPage(page: PageWithMetrics): void {
    if (!page || !page.isActive) {
      return;
    }

    page.loadingMetrics = true;

    const metricKeysParam = this.selectedMetricKeys.join(',');

    // Usar directamente el endpoint /metrics que es el que existe según la documentación
    const metricsSubscription = this.analyticsService.getPageMetrics(
      page.facebookPageId,
      this.fromDate,
      this.toDate,
      metricKeysParam
    ).subscribe({
      next: (response) => {
        if (response.data?.metrics?.length > 0) {
          const chartData = this.transformMetricsToChartFormat(response.data);
          page.chartData = chartData;
          this.updateChart(chartData);
        } else {
          page.chartData = undefined;
          this.updateChart(null);
        }
        page.loadingMetrics = false;
      },
      error: (error) => {
        page.chartData = undefined;
        page.loadingMetrics = false;
        this.updateChart(null);
      }
    });

    this.subscriptions.add(metricsSubscription);
  }

  /**
   * Transforma los datos del endpoint /metrics al formato de /chart
   */
  private transformMetricsToChartFormat(data: PageMetricsResponse['data']): { labels: string[]; series: ChartMetricSeries[] } {
    // Obtener todas las fechas únicas
    // Las fechas vienen en formato ISO (2026-01-23T02:34:44.663Z), extraer solo la parte de fecha
    const allDates = new Set<string>();

    data.metrics.forEach(metric => {
      metric.dailyValues?.forEach(dv => {
        const dateStr = typeof dv.date === 'string' ? dv.date.split('T')[0] : dv.date;
        allDates.add(dateStr);
      });
    });

    const sortedDates = Array.from(allDates).sort();

    // Crear series para cada métrica
    const series: ChartMetricSeries[] = data.metrics.map(metric => {
      const metricConfig = this.availableMetrics.find(m => m.key === metric.metricKey);

      // Crear array de valores alineados con las fechas
      const values = sortedDates.map(date => {
        const dailyValue = metric.dailyValues?.find(dv => {
          const dvDate = typeof dv.date === 'string' ? dv.date.split('T')[0] : dv.date;
          return dvDate === date;
        });
        return dailyValue?.value ?? null;
      });

      return {
        metricKey: metric.metricKey,
        label: metricConfig?.label || metric.metricKey,
        values: values,
        color: metricConfig?.color || '#3d79ee',
        statistics: {
          total: metric.total ?? 0,
          average: metric.average ?? 0,
          max: metric.max ?? 0,
          min: metric.min ?? 0
        }
      };
    });

    return { labels: sortedDates, series };
  }

  /**
   * Actualiza el gráfico con las métricas seleccionadas usando ECharts
   */
  updateChart(chartData: { labels: string[]; series: ChartMetricSeries[] } | null, title?: string): void {
    if (!chartData?.series?.length) {
      this.chartOptions = {
        title: {
          text: 'No hay datos disponibles',
          left: 'center',
          top: 'middle',
          textStyle: {
            color: '#9ca3af',
            fontSize: 16
          }
        }
      };
      return;
    }

    // Formatear fechas para mostrar en el gráfico (las labels vienen en formato yyyy-MM-dd)
    const formattedLabels = chartData.labels.map(dateStr => {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    // Crear series para cada métrica
    const series: echarts.LineSeriesOption[] = chartData.series.map(metricSeries => {
      // Convertir valores a números, mantener null para valores faltantes
      const cleanValues = metricSeries.values.map(v => v === null || v === undefined ? null : Number(v));

      return {
        name: metricSeries.label,
        type: 'line' as const,
        data: cleanValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: true,
        connectNulls: false, // No conectar puntos nulos
        lineStyle: {
          color: metricSeries.color,
          width: 2
        },
        itemStyle: {
          color: metricSeries.color
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: metricSeries.color + '80' },
              { offset: 1, color: metricSeries.color + '10' }
            ]
          }
        }
      };
    });

    // Configurar opciones de ECharts
    this.chartOptions = {
      title: {
        text: title || 'Evolución de Métricas',
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#111827'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: (params: unknown) => {
          const paramsArray = Array.isArray(params) ? params : [params];
          let result = `<div style="margin-bottom: 4px; font-weight: 600;">${(paramsArray[0] as { axisValue: string })?.axisValue}</div>`;
          paramsArray.forEach((param: unknown) => {
            const p = param as { color: string; seriesName: string; value: number };
            if (p?.value != null) {
              result += `<div style="margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; background: ${p.color}; border-radius: 50%; margin-right: 8px;"></span>
                ${p.seriesName}: <strong>${this.formatNumber(p.value)}</strong>
              </div>`;
            }
          });
          return result;
        }
      },
      legend: {
        data: series.map(s => s.name).filter((name): name is string => typeof name === 'string'),
        top: 40,
        textStyle: {
          color: '#374151'
        }
      } as echarts.LegendComponentOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 80,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: formattedLabels,
        axisLabel: {
          color: '#6b7280'
        },
        axisLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        }
      },
      yAxis: {
        type: 'value',
        scale: false, // No usar escala automática para mejor visualización
        axisLabel: {
          color: '#6b7280',
          formatter: (value: number) => {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'K';
            }
            return value.toString();
          }
        },
        axisLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#f3f4f6',
            type: 'dashed'
          }
        }
      },
      series: series,
      animation: true,
      animationDuration: 750,
      animationEasing: 'cubicOut'
    };

    // Forzar detección de cambios para actualizar el gráfico
    this.cdr.detectChanges();
  }

  /**
   * Selecciona un grupo y carga sus métricas
   */
  selectGroup(group: GroupWithMetrics): void {
    this.groups.forEach(g => g.selected = false);
    group.selected = true;
    this.selectedGroup = group;
    this.loadMetricsForGroup(group);
  }

  /**
   * Carga las métricas de un grupo para el rango de fechas seleccionado
   */
  loadMetricsForGroup(group: GroupWithMetrics): void {
    if (!group || !group.isActive) {
      return;
    }

    group.loadingMetrics = true;

    const metricKeysParam = this.selectedMetricKeys.join(',');

    const metricsSubscription = this.groupsService.getGroupMetrics(
      group.facebookGroupId,
      this.fromDate,
      this.toDate,
      metricKeysParam
    ).subscribe({
      next: (response) => {
        if (response.data?.metrics?.length > 0) {
          const chartData = this.transformGroupMetricsToChartFormat(response.data);
          group.chartData = chartData;
          this.updateChart(chartData, group.name);
        } else {
          group.chartData = undefined;
          this.updateChart(null);
        }
        group.loadingMetrics = false;
      },
      error: (error) => {
        group.chartData = undefined;
        group.loadingMetrics = false;
        this.updateChart(null);
        console.error('Error al cargar métricas del grupo:', error);
      }
    });

    this.subscriptions.add(metricsSubscription);
  }

  /**
   * Transforma los datos de métricas de grupos al formato de gráfico
   */
  private transformGroupMetricsToChartFormat(data: GroupMetricsResponse['data']): { labels: string[]; series: ChartMetricSeries[] } {
    const allDates = new Set<string>();

    data.metrics.forEach(metric => {
      metric.dailyValues?.forEach(dv => {
        const dateStr = typeof dv.date === 'string' ? dv.date.split('T')[0] : dv.date;
        allDates.add(dateStr);
      });
    });

    const sortedDates = Array.from(allDates).sort();

    const series: ChartMetricSeries[] = data.metrics.map(metric => {
      const metricConfig = this.availableGroupMetrics.find(m => m.key === metric.metricKey);

      const values = sortedDates.map(date => {
        const dailyValue = metric.dailyValues?.find(dv => {
          const dvDate = typeof dv.date === 'string' ? dv.date.split('T')[0] : dv.date;
          return dvDate === date;
        });
        return dailyValue?.value ?? null;
      });

      return {
        metricKey: metric.metricKey,
        label: metricConfig?.label || metric.metricKey,
        values: values,
        color: metricConfig?.color || '#3d79ee',
        statistics: {
          total: metric.total ?? 0,
          average: metric.average ?? 0,
          max: metric.max ?? 0,
          min: metric.min ?? 0
        }
      };
    });

    return { labels: sortedDates, series };
  }

  /**
   * Cambia el rango de fechas y recarga las métricas
   */
  onDateRangeChange(): void {
    if (this.activeCategory === 'pages' && this.selectedPage) {
      this.loadMetricsForPage(this.selectedPage);
    } else if (this.activeCategory === 'groups' && this.selectedGroup) {
      this.loadMetricsForGroup(this.selectedGroup);
    }
  }

  /**
   * Cambia las métricas seleccionadas y recarga
   */
  onMetricSelectionChange(): void {
    if (this.activeCategory === 'pages' && this.selectedPage) {
      this.loadMetricsForPage(this.selectedPage);
    } else if (this.activeCategory === 'groups' && this.selectedGroup) {
      this.loadMetricsForGroup(this.selectedGroup);
    }
  }

  /**
   * Cambia la vista activa (overview o detailed)
   */
  switchView(view: ViewType): void {
    this.activeView = view;

    // Si cambiamos a vista detallada y no hay página/grupo seleccionado, seleccionar el primero
    if (view === 'detailed') {
      if (this.activeCategory === 'pages' && this.pages.length > 0 && !this.selectedPage) {
        this.selectPage(this.pages[0]);
      } else if (this.activeCategory === 'groups' && this.groups.length > 0 && !this.selectedGroup) {
        this.selectGroup(this.groups[0]);
      }
    }
  }

  /**
   * Obtiene el tiempo transcurrido desde una fecha
   */
  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'hace menos de un minuto';
    } else if (diffMins < 60) {
      return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else {
      return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    }
  }

  /**
   * Sincroniza las métricas de la página seleccionada
   */
  syncPageMetrics(): void {
    if (!this.selectedPage || this.syncing) {
      return;
    }

    this.syncing = true;
    this.syncProgress = `Sincronizando métricas de ${this.selectedPage.name}...`;

    const syncSubscription = this.analyticsService.syncAnalytics({
      pageIds: [this.selectedPage.facebookPageId],
      onlyActive: true
    }).subscribe({
      next: (response) => {
        this.syncProgress = `Sincronización completada: ${response.data.pagesOk} páginas exitosas`;

        // Recargar métricas después de la sincronización
        setTimeout(() => {
          if (this.selectedPage) {
            this.loadMetricsForPage(this.selectedPage);
          }
          this.syncing = false;
          this.syncProgress = '';
        }, 1000);
      },
      error: (error) => {
        this.syncProgress = `Error: ${error.message}`;
        this.syncing = false;
        setTimeout(() => {
          this.syncProgress = '';
        }, 5000);
      }
    });

    this.subscriptions.add(syncSubscription);
  }

  /**
   * Formatea un número con separadores de miles
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
  }

  /**
   * Toggle de selección de métrica
   */
  toggleMetric(metricKey: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      if (!this.selectedMetricKeys.includes(metricKey)) {
        this.selectedMetricKeys.push(metricKey);
      }
    } else {
      this.selectedMetricKeys = this.selectedMetricKeys.filter(key => key !== metricKey);
    }
  }

  /**
   * Obtiene el label de una métrica
   */
  getMetricLabel(metricKey: string): string {
    const metric = this.availableMetrics.find(m => m.key === metricKey);
    return metric?.label || metricKey;
  }

  /**
   * Obtiene el color de una métrica
   */
  getMetricColor(metricKey: string): string {
    const metric = this.availableMetrics.find(m => m.key === metricKey);
    return metric?.color || '#3d79ee';
  }

  /**
   * Redondea un número
   */
  getRoundedAverage(value: number): number {
    return Math.round(value);
  }
}
