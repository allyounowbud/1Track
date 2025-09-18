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
  isLoading = false,
  error = null
}) {
  // Get unique categories from products
  const uniqueCategories = [...new Set(products.map(p => p.product_category))].filter(Boolean);
  const categories = uniqueCategories.map(cat => ({ 
    key: cat, 
    label: cat, 
    color: 'blue' 
  }));

  const getCategoryProducts = (category) => {
    return products.filter(p => p.product_category === category);
  };

  const getCategorySelectedCount = (category) => {
    return Array.from(selectedProducts).filter(id => {
      const product = products.find(p => p.id === id);
      return product && product.product_category === category;
    }).length;
  };

  const toggleCategorySelection = (category) => {
    const categoryProducts = getCategoryProducts(category);
    const categorySelectedCount = getCategorySelectedCount(category);
    const isFullySelected = categorySelectedCount === categoryProducts.length;
    
    if (isFullySelected) {
      // Deselect all products in this category
      categoryProducts.forEach(product => {
        if (selectedProducts.has(product.id)) {
          onToggleProductSelection(product.id);
        }
      });
    } else {
      // Select all products in this category
      categoryProducts.forEach(product => {
        if (!selectedProducts.has(product.id)) {
          onToggleProductSelection(product.id);
        }
      });
    }
  };

  const hasAnySelection = selectedProducts.size > 0;
  const hasNewRows = newProductRows.length > 0;
  const totalProducts = products.length;


  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-slate-400 text-lg">Loading products...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400 text-lg mb-4">Error loading products</div>
          <div className="text-gray-600 dark:text-slate-400 text-sm">{error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">

      {/* Add New Product Section - Show when adding new products */}
      {hasNewRows && (
        <div className="w-full">
          {/* Section Header */}
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add new product...</h3>
          </div>

          {/* New Product Rows */}
          <div className="w-full">
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
                existingCategories={uniqueCategories}
              />
            ))}
          </div>
        </div>
      )}

      {/* Categories - Show as expandable sections (hidden when adding new products) */}
      {!hasNewRows && totalProducts > 0 && (
        <div className="w-full">
          {/* Bulk Actions Row - positioned like first category card */}
          <div className="w-full rounded-xl p-4 mb-3 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              {/* Left side - Selection Count */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === totalProducts && totalProducts > 0}
                    onChange={() => onToggleAllProductsSelection('all')}
                    className="h-4 w-4 rounded border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-2 transition-all flex-shrink-0 accent-indigo-500"
                  />
                  <div className="text-sm sm:text-base font-medium text-gray-700 dark:text-slate-300">
                    {selectedProducts.size}/{totalProducts} Selected
                  </div>
                </div>
              </div>

              {/* Right side - Action Buttons */}
              <div className="flex items-center gap-2">
                {!hasAnySelection && (
                  <button
                    onClick={() => onAddNewProductRow()}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                    title="Add New Item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="hidden sm:inline">Add Product</span>
                  </button>
                )}
                
                {hasAnySelection && (
                  <>
                    <button
                      onClick={onBulkSave}
                      className="px-3 py-2 rounded-lg border border-indigo-500 bg-indigo-500 hover:bg-indigo-600 text-white transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                      title="Save Changes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                      onClick={() => onToggleAllProductsSelection(false)}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                      title="Cancel Selection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="hidden sm:inline">Cancel</span>
                    </button>
                    <button
                      onClick={onBulkDelete}
                      className="px-3 py-2 rounded-lg border border-rose-500 bg-rose-500 hover:bg-rose-600 text-white transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                      title="Delete Selected"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {categories.map(category => {
            const categoryProducts = getCategoryProducts(category.key);
            const isExpanded = expandedCategories.has(category.key);

            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.key} className="w-full">
                {/* Category Header */}
                <div 
                   className={`flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${
                     !isExpanded 
                       ? 'border border-gray-200 dark:border-slate-700 rounded-xl mb-3 bg-white dark:bg-slate-800/50' 
                       : 'bg-gray-50 dark:bg-transparent'
                   }`}
                  onClick={() => onToggleCategoryExpansion(category.key)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={getCategorySelectedCount(category.key) === categoryProducts.length && categoryProducts.length > 0}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCategorySelection(category.key);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-2 transition-all accent-indigo-500"
                    />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{category.label}</h3>
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      ({categoryProducts.length} items)
                    </span>
                  </div>
                  <div className="text-gray-600 dark:text-slate-400 text-sm transition-transform duration-200 ease-in-out">
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ease-in-out ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Category Content */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="w-full">
                    {categoryProducts.map(product => (
                      <CategoryItemRow
                        key={product.id}
                        item={product}
                        isSelected={selectedProducts.has(product.id)}
                        onToggleSelection={() => onToggleProductSelection(product.id)}
                        onSave={() => onRefetch()}
                        disabled={hasNewRows}
                        category={product.product_category}
                        isCheckboxDisabled={hasNewRows}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Empty State - Show when no products and no new rows */}
      {totalProducts === 0 && !hasNewRows && (
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-slate-400 text-lg mb-4">No products yet</div>
          <div className="text-slate-500 text-sm">
            Start building your product database by{" "}
            <button
                onClick={() => onAddNewProductRow('Collectibles')}
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