import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataServiceV2 as dataService } from '../services/dataServiceV2';

export const useCollection = () => {
  const queryClient = useQueryClient();

  // Fetch collection data (aggregated)
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['collection-aggregated'],
    queryFn: async () => {
      try {
        console.log('useCollection: Starting to fetch aggregated items...');
        const result = await dataService.getAggregatedCollectionItems();
        console.log('useCollection: Got result:', result);
        return result;
      } catch (err) {
        console.error('Error fetching collection items:', err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch collection stats
  const { data: stats = {} } = useQuery({
    queryKey: ['collection-stats'],
    queryFn: async () => {
      try {
        return await dataService.getCollectionStats();
      } catch (err) {
        console.error('Error fetching collection stats:', err);
        return {
          totalValue: 0,
          totalPaid: 0,
          totalItems: 0,
          ungraded: 0,
          graded: 0,
          sealed: 0,
          profitLoss: 0,
          profitLossPercent: 0
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter and sort items
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const filteredItems = items
    .filter(item => {
      if (filter === 'all') return true;
      return item.status === filter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'value':
          return (b.marketValue || b.buyPrice) - (a.marketValue || a.buyPrice);
        case 'date':
        default:
          return new Date(b.orderDate) - new Date(a.orderDate);
      }
    });

  // Add new item mutation
  const addItemMutation = useMutation({
    mutationFn: dataService.addOrder,
    onSuccess: () => {
      queryClient.invalidateQueries(['collection-aggregated']);
      queryClient.invalidateQueries(['collection-stats']);
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ id, updates }) => dataService.updateOrder(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['collection-aggregated']);
      queryClient.invalidateQueries(['collection-stats']);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: dataService.deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries(['collection-aggregated']);
      queryClient.invalidateQueries(['collection-stats']);
    },
  });

  // Add new item
  const addItem = (itemData) => {
    addItemMutation.mutate({
      item: itemData.name,
      retailer: 'Manual Entry',
      order_date: new Date().toISOString().split('T')[0],
      buy_price_cents: itemData.buyPrice,
      status: 'ordered',
      profile_name: 'Manual Entry',
      marketplace: 'Manual Entry'
    });
  };

  // Update item
  const updateItem = (id, updates) => {
    updateItemMutation.mutate({ id, updates });
  };

  // Delete item
  const deleteItem = (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(id);
    }
  };

  return {
    items: filteredItems,
    totalItems: stats.totalItems || 0,
    totalValue: stats.totalValue || 0,
    totalPaid: stats.totalPaid || 0,
    profitLoss: stats.profitLoss || 0,
    profitLossPercent: stats.profitLossPercent || 0,
    ungraded: stats.ungraded || 0,
    graded: stats.graded || 0,
    sealed: stats.sealed || 0,
    filter,
    setFilter,
    sortBy,
    setSortBy,
    addItem,
    updateItem,
    deleteItem,
    loading: isLoading,
    error,
  };
};