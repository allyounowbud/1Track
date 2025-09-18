import { useState } from "react";
import { CategoryItemRow, NewCategoryRowComponent } from "./CategoryComponents.jsx";
import { UnifiedNewProductRow } from "./UnifiedNewProductRow.jsx";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

export default function UnifiedProductsCard({
  products,
  selectedProducts,
  newProductRows,
  expandedCategories,
  onToggleProductSelection,
  onToggleAllProductsSelection,
  onAddNewProductRow,
  onBulkSave,
  onBulkDelete,
  onToggleCategoryExpansion,
  onRefetch,
  onRemoveNewRow,
  marketData,
  marketDataLoading
}) {
  const categories = [
    { key: 'tcg_sealed', label: 'TCG Sealed', color: 'blue' },
    { key: 'tcg_singles', label: 'TCG Singles', color: 'blue' },
    { key: 'video_games', label: 'Video Games', color: 'blue' },
    { key: 'other_items', label: 'Other Items', color: 'blue' }
  ];

  const getCategoryProducts = (category) => {
    return products.filter(p => p.category === category);
  };

  const getCategorySelectedCount = (category) => {
    return Array.from(selectedProducts).filter(id => {
      const product = products.find(p => p.id === id);
      return product && product.category === category;
    }).length;
  };

  const hasAnySelection = selectedProducts.size > 0;
  const hasNewRows = newProductRows.length > 0;
  const totalProducts = products.length;

  return (
    <div className="space-y-6">
      {/* Header with Selection Count and Actions */}
      {!hasNewRows && totalProducts > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* Left side - Selection Count */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedProducts.size === totalProducts && totalProducts > 0}
                onChange={() => onToggleAllProductsSelection('all')}
                className="h-4 w-4 rounded border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-2 transition-all flex-shrink-0 accent-indigo-500"
              />
              <div>
                <div className="text-sm sm:text-lg text-gray-600 dark:text-slate-400 whitespace-nowrap">
                  {selectedProducts.size}/{totalProducts} Selected
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Action Buttons */}
          <div className="flex items-center gap-2">
            {!hasAnySelection && (
              <button
                onClick={() => onAddNewProductRow('tcg_sealed')}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center justify-center group"
                title="Add New Item"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}
            
            {hasAnySelection && (
              <>
                <button
                  onClick={onBulkSave}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center justify-center group"
                  title="Save Changes"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onToggleAllProductsSelection(false)}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center justify-center group"
                  title="Cancel Selection"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={onBulkDelete}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-rose-600 bg-rose-600/20 hover:bg-rose-600/30 hover:border-rose-500 text-rose-400 transition-all duration-200 flex items-center justify-center group"
                  title="Delete Selected"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Categories - Show as expandable sections */}
      {(totalProducts > 0 || hasNewRows) && (
        <div className="space-y-2">
          {categories.map(category => {
            const categoryProducts = getCategoryProducts(category.key);
            const isExpanded = expandedCategories.has(category.key);

            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.key} className="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800/30">
                {/* Category Header */}
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border-b border-gray-200 dark:border-slate-700"
                  onClick={() => onToggleCategoryExpansion(category.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{category.label}</h3>
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      ({categoryProducts.length} items)
                    </span>
                  </div>
                  <div className="text-gray-600 dark:text-slate-400 text-sm">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>

                {/* Category Content */}
                {isExpanded && (
                  <div className="divide-y divide-gray-200 dark:divide-slate-700">
                    {categoryProducts.map(product => (
                      <CategoryItemRow
                        key={product.id}
                        item={product}
                        isSelected={selectedProducts.has(product.id)}
                        onToggleSelection={() => onToggleProductSelection(product.id)}
                        onSave={() => onRefetch()}
                        disabled={hasNewRows}
                        category={product.category}
                        isCheckboxDisabled={hasNewRows}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Product Rows */}
      {hasNewRows && (
        <div className="space-y-2">
          {newProductRows.map(newRow => (
            <UnifiedNewProductRow
              key={newRow.id}
              row={newRow}
              isSelected={selectedProducts.has(newRow.id)}
              onToggleSelection={() => onToggleProductSelection(newRow.id)}
              onSave={(data) => {
                onRemoveNewRow(newRow.id);
                onRefetch();
              }}
              onCancel={() => {
                onRemoveNewRow(newRow.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State - Show when no products and no new rows */}
      {totalProducts === 0 && !hasNewRows && (
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-slate-400 text-lg mb-4">No products yet</div>
          <div className="text-slate-500 text-sm">
            Start building your product database by{" "}
            <button
              onClick={() => onAddNewProductRow('tcg_sealed')}
              className="text-blue-400 hover:text-blue-300 underline cursor-pointer transition-colors"
            >
              + adding
            </button>{" "}
            your first item
          </div>
        </div>
      )}

    </div>
  );
}