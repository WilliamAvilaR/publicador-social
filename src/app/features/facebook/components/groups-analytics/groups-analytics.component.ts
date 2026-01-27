import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts';
import { FacebookGroupsService } from '../../services/facebook-groups.service';
import { FacebookGroup, ChartMetricSeries, GroupMetricsResponse } from '../../models/facebook.model';

interface GroupWithMetrics extends FacebookGroup {
  chartData?: {
    labels: string[];
    series: ChartMetricSeries[];
  };
  loadingMetrics?: boolean;
  selected?: boolean;
}

@Component({
  selector: 'app-groups-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsModule],
  templateUrl: './groups-analytics.component.html',
  styleUrl: './groups-analytics.component.scss'
})
export class GroupsAnalyticsComponent implements OnInit, OnDestroy {
  groups: GroupWithMetrics[] = [];
  selectedGroup: GroupWithMetrics | null = null;
  loading = true;
  error: string | null = null;

  // Fechas por defecto: últimos 30 días
  fromDate: string = this.getDateString(-30);
  toDate: string = this.getDateString(0);

  // Configuración de ECharts
  chartOptions: echarts.EChartsOption = {};

  // Métricas disponibles para grupos
  availableMetrics = [
    { key: 'member_count', label: 'Miembros', color: '#3d79ee' },
    { key: 'post_count', label: 'Publicaciones', color: '#10b981' },
    { key: 'engagement', label: 'Interacciones', color: '#f59e0b' }
  ];

  selectedMetricKeys: string[] = ['member_count', 'post_count'];

  private subscriptions = new Subscription();

  constructor(
    private groupsService: FacebookGroupsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadGroups();
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
   * Carga los grupos conectados
   */
  loadGroups(): void {
    this.loading = true;
    this.error = null;

    const groupsSubscription = this.groupsService.getGroups().subscribe({
      next: (response) => {
        this.groups = response.data
          .filter(group => group.isActive)
          .map(group => ({ ...group, selected: false }));

        if (this.groups.length > 0) {
          this.selectedGroup = this.groups[0];
          this.selectedGroup.selected = true;
          this.loadMetricsForGroup(this.selectedGroup);
        }

        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar los grupos';
        this.loading = false;
        console.error('Error al cargar grupos:', error);
      }
    });

    this.subscriptions.add(groupsSubscription);
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

    // Usar el endpoint /metrics
    const metricsSubscription = this.groupsService.getGroupMetrics(
      group.facebookGroupId,
      this.fromDate,
      this.toDate,
      metricKeysParam
    ).subscribe({
      next: (response) => {
        if (response.data?.metrics?.length > 0) {
          const chartData = this.transformMetricsToChartFormat(response.data);
          group.chartData = chartData;
          this.updateChart(chartData);
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
        console.error('Error al cargar métricas:', error);
      }
    });

    this.subscriptions.add(metricsSubscription);
  }

  /**
   * Transforma los datos del endpoint /metrics al formato de /chart
   */
  private transformMetricsToChartFormat(data: GroupMetricsResponse['data']): { labels: string[]; series: ChartMetricSeries[] } {
    // Obtener todas las fechas únicas
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

    // Formatear fechas para mostrar en el gráfico
    const formattedLabels = chartData.labels.map(dateStr => {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    // Crear series para cada métrica
    const series: echarts.LineSeriesOption[] = chartData.series.map(metricSeries => {
      const cleanValues = metricSeries.values.map(v => v === null || v === undefined ? null : Number(v));

      return {
        name: metricSeries.label,
        type: 'line' as const,
        data: cleanValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: true,
        connectNulls: false,
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
        text: 'Evolución de Métricas del Grupo',
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
        data: chartData.series.map(s => s.label),
        bottom: 0,
        textStyle: {
          color: '#6b7280'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: formattedLabels,
        axisLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        },
        axisLabel: {
          color: '#6b7280'
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        },
        axisLabel: {
          color: '#6b7280',
          formatter: (value: number) => this.formatNumber(value)
        },
        splitLine: {
          lineStyle: {
            color: '#f3f4f6'
          }
        }
      },
      series: series
    };

    this.cdr.detectChanges();
  }

  /**
   * Maneja el cambio en el rango de fechas
   */
  onDateRangeChange(): void {
    if (this.selectedGroup) {
      this.loadMetricsForGroup(this.selectedGroup);
    }
  }

  /**
   * Maneja el cambio en la selección de métricas
   */
  onMetricSelectionChange(): void {
    if (this.selectedGroup) {
      this.loadMetricsForGroup(this.selectedGroup);
    }
  }

  /**
   * Alterna una métrica específica
   */
  toggleMetric(metricKey: string, event: Event): void {
    event.preventDefault();
    const index = this.selectedMetricKeys.indexOf(metricKey);
    if (index > -1) {
      this.selectedMetricKeys.splice(index, 1);
    } else {
      this.selectedMetricKeys.push(metricKey);
    }
    this.onMetricSelectionChange();
  }

  /**
   * Formatea un número para mostrar en el gráfico
   */
  formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  /**
   * Redondea un promedio para mostrar
   */
  getRoundedAverage(value: number): number {
    return Math.round(value);
  }
}
