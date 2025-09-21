import React, { useState, useEffect } from 'react';

const CollectionChart = ({ timeRange = '7D', totalValue, totalPaid }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock chart data for now - in production this would come from your database
  useEffect(() => {
    const generateMockData = () => {
      const days = timeRange === '7D' ? 7 : timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : 365;
      const data = [];
      
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Simulate gradual growth with some volatility
        const baseValue = totalValue * 0.8;
        const volatility = (Math.random() - 0.5) * 0.1;
        const growth = (days - i) / days * 0.2;
        const marketValue = baseValue * (1 + growth + volatility);
        
        const basePaid = totalPaid * 0.8;
        const paidGrowth = (days - i) / days * 0.2;
        const paidValue = basePaid * (1 + paidGrowth);
        
        data.push({
          date: date.toISOString().split('T')[0],
          marketValue: Math.round(marketValue),
          totalPaid: Math.round(paidValue)
        });
      }
      
      return data;
    };

    setChartData(generateMockData());
    setLoading(false);
  }, [timeRange, totalValue, totalPaid]);

  if (loading) {
    return (
      <div className="h-40 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading chart...</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-40 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-gray-400 text-sm">No chart data available</div>
      </div>
    );
  }

  // Calculate chart dimensions and scaling
  const chartHeight = 160;
  const chartWidth = 300;
  const padding = 20;
  
  const values = chartData.map(d => [d.marketValue, d.totalPaid]).flat().filter(v => !isNaN(v) && v !== null && v !== undefined);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1000;
  const valueRange = maxValue - minValue || 1000; // Avoid division by zero
  
  // Convert values to chart coordinates
  const getY = (value) => {
    if (isNaN(value) || value === null || value === undefined) {
      return chartHeight / 2; // Center if invalid value
    }
    return chartHeight - padding - ((value - minValue) / valueRange) * (chartHeight - 2 * padding);
  };
  
  const getX = (index) => {
    if (chartData.length <= 1) return padding;
    return padding + (index / (chartData.length - 1)) * (chartWidth - 2 * padding);
  };

  // Generate SVG path for market value line
  const marketValuePath = chartData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.marketValue)}`)
    .join(' ');

  // Generate SVG path for total paid line
  const totalPaidPath = chartData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.totalPaid)}`)
    .join(' ');

  return (
    <div className="h-40 bg-gray-900 rounded-lg p-4">
      <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Market value line (blue) */}
        <path
          d={marketValuePath}
          fill="none"
          stroke="#10b981" // emerald-500
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Total paid line (red) */}
        <path
          d={totalPaidPath}
          fill="none"
          stroke="#ef4444" // red-500
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {chartData.map((point, index) => (
          <g key={index}>
            {/* Market value point */}
            <circle
              cx={getX(index)}
              cy={getY(point.marketValue)}
              r="2"
              fill="#10b981"
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
            {/* Total paid point */}
            <circle
              cx={getX(index)}
              cy={getY(point.totalPaid)}
              r="2"
              fill="#ef4444"
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
          </g>
        ))}
        
        {/* Y-axis labels */}
        <text x="5" y={getY(maxValue) + 5} fill="#9ca3af" fontSize="10" textAnchor="start">
          ${(maxValue / 100).toFixed(0)}
        </text>
        <text x="5" y={getY(minValue) + 5} fill="#9ca3af" fontSize="10" textAnchor="start">
          ${(minValue / 100).toFixed(0)}
        </text>
        
        {/* X-axis labels */}
        <text x={getX(0)} y={chartHeight - 5} fill="#9ca3af" fontSize="10" textAnchor="middle">
          {new Date(chartData[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
        <text x={getX(chartData.length - 1)} y={chartHeight - 5} fill="#9ca3af" fontSize="10" textAnchor="middle">
          {new Date(chartData[chartData.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      </svg>
      
      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 mt-2 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-0.5 bg-emerald-500"></div>
          <span className="text-gray-400">Market Value</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-0.5 bg-red-500"></div>
          <span className="text-gray-400">Total Paid</span>
        </div>
      </div>
    </div>
  );
};

export default CollectionChart;
