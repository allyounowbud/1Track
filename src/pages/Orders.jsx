import { useState } from 'react';

const Orders = () => {
  const [orders] = useState([
    {
      id: '1',
      item: 'Charizard Base Set',
      orderDate: '2024-01-15',
      buyPrice: 50000,
      status: 'ordered',
      retailer: 'TCGPlayer'
    },
    {
      id: '2',
      item: 'Blastoise Base Set',
      orderDate: '2024-01-10',
      buyPrice: 30000,
      status: 'sold',
      saleDate: '2024-02-01',
      salePrice: 45000,
      retailer: 'eBay'
    }
  ]);

  const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your purchase history</p>
        </div>
        <button className="btn btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {orders.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Orders</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-success-600 dark:text-success-400">
            {orders.filter(o => o.status === 'sold').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Sold</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-warning-600 dark:text-warning-400">
            {orders.filter(o => o.status === 'ordered').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {order.item}
                </h3>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span>Ordered: {formatDate(order.orderDate)}</span>
                  <span>From: {order.retailer}</span>
                  <span>Price: {formatPrice(order.buyPrice)}</span>
                </div>
                {order.saleDate && (
                  <div className="text-sm text-success-600 dark:text-success-400 mt-1">
                    Sold: {formatDate(order.saleDate)} for {formatPrice(order.salePrice)}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  order.status === 'sold' 
                    ? 'status-sold' 
                    : order.status === 'ordered'
                    ? 'status-ordered'
                    : 'status-pending'
                }`}>
                  {order.status}
                </span>
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
