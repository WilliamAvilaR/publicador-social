import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookAnalyticsService } from '../../services/facebook-analytics.service';
import { FacebookPage, ChartMetricSeries, PageMetricsResponse } from '../../models/facebook.model';

interface PageWithMetrics extends FacebookPage {
  chartData?: {
    labels: string[];
    series: ChartMetricSeries[];
  };
  loadingMetrics?: boolean;
  selected?: boolean;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  pages: PageWithMetrics[] = [];
  selectedPage: PageWithMetrics | null = null;
  loading = true;
  error: string | null = null;
  syncing = false;
  syncProgress: string = '';

  // Fechas por defecto: últimos 30 días
  fromDate: string = this.getDateString(-30);
  toDate: string = this.getDateString(0);

  // Configuración de ECharts
  chartOptions: echarts.EChartsOption = {};

  // Métricas disponibles
  availableMetrics = [
    { key: 'page_fans', label: 'Fans', color: '#3d79ee' },
    { key: 'page_followers', label: 'Seguidores', color: '#10b981' },
    { key: 'page_follows', label: 'Nuevos Seguidores', color: '#10b981' },
    { key: 'page_reach', label: 'Alcance', color: '#f59e0b' },
    { key: 'page_impressions', label: 'Impresiones', color: '#ef4444' },
    { key: 'page_impressions_unique', label: 'Alcance Único', color: '#ef4444' },
    { key: 'page_engaged_users', label: 'Usuarios que interactuaron', color: '#8b5cf6' },
    { key: 'page_post_engagements', label: 'Engagement total', color: '#ec4899' }
  ];

  selectedMetricKeys: string[] = ['page_impressions_unique', 'page_follows', 'page_post_engagements'];

  private subscriptions = new Subscription();

  constructor(
    private facebookService: FacebookOAuthService,
    private analyticsService: FacebookAnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPages();
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
    this.loading = true;
    this.error = null;

    const pagesSubscription = this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        this.pages = pages
          .filter(page => page.isActive)
          .map(page => ({ ...page, selected: false }));

        if (this.pages.length > 0) {
          this.selectedPage = this.pages[0];
          this.selectedPage.selected = true;
          this.loadMetricsForPage(this.selectedPage);
        }

        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar las páginas';
        this.loading = false;
        console.error('Error al cargar páginas:', error);
      }
    });

    this.subscriptions.add(pagesSubscription);
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
  updateChart(chartData: { labels: string[]; series: ChartMetricSeries[] } | null): void {
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
        text: 'Evolución de Métricas',
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
   * Cambia el rango de fechas y recarga las métricas
   */
  onDateRangeChange(): void {
    if (this.selectedPage) {
      this.loadMetricsForPage(this.selectedPage);
    }
  }

  /**
   * Cambia las métricas seleccionadas y recarga
   */
  onMetricSelectionChange(): void {
    if (this.selectedPage) {
      this.loadMetricsForPage(this.selectedPage);
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
