import { useState } from 'react';

const ItemCard = ({ item, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: item.name,
    buyPrice: item.buyPrice,
    quantity: item.quantity,
    notes: item.notes || ''
  });

  const handleSave = () => {
    onUpdate(item.id, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      name: item.name,
      buyPrice: item.buyPrice,
      quantity: item.quantity,
      notes: item.notes || ''
    });
    setIsEditing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ordered':
        return 'status-ordered';
      case 'sold':
        return 'status-sold';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-ordered';
    }
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Calculate profit/loss using aggregated totals
  const totalProfitLoss = (item.totalMarketValue || 0) - (item.totalPaid || 0);
  const profitLossPercent = item.totalPaid ? ((totalProfitLoss / item.totalPaid) * 100) : 0;
  const isProfit = totalProfitLoss >= 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Card Image */}
      <div className="aspect-[4/3] bg-gray-700 flex items-center justify-center">
        {item.imageUrl ? (
          <img 
            src={item.imageUrl} 
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-xs">No Image</div>
        )}
      </div>
      
      {/* Card Details */}
      <div className="p-2 space-y-1">
        {/* Set/Category */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-500 rounded-sm"></div>
          <span className="text-xs text-gray-400 truncate">{item.item?.set_name || item.item?.category || 'Unknown Set'}</span>
        </div>
        
        {/* Item Name */}
        <div>
          <h3 className="text-xs font-medium text-white leading-tight line-clamp-2">
            {item.name || 'Unknown Item'}
          </h3>
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {item.item?.set_name || item.item?.category || 'Unknown Set'}
          </div>
        </div>
        
        {/* Status */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-green-400 font-medium">Sealed</span>
          {isProfit ? (
            <svg className="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        
        {/* Financial Details */}
        <div className="space-y-0.5">
          <div className="text-xs text-white">
            {formatPrice(item.totalMarketValue || item.marketValue || 0)} Value • Qty {item.quantity || 1}
          </div>
          <div className="text-xs text-white">
            {formatPrice(item.totalPaid || item.buyPrice || 0)} Paid 
            <span className={`ml-1 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              ({isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        
        {/* Menu Button */}
        <div className="flex justify-end">
          <button className="text-gray-400 hover:text-white">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
