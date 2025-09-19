import { useState } from "react";
import { SimpleItemRow, NewSimpleRowComponent } from "./CategoryComponents.jsx";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

export default function UnifiedMarketplacesCard({
  marketplaces,
  selectedMarketplaces,
  newMarketplaceRows,
  onToggleMarketplaceSelection,
  onToggleAllMarketplacesSelection,
  onAddNewMarketplaceRow,
  onBulkSave,
  onBulkDelete,
  onRefetch,
  onRemoveNewRow
}) {
  const hasAnySelection = selectedMarketplaces.size > 0;
  const hasNewRows = newMarketplaceRows.length > 0;
  const totalMarketplaces = marketplaces.length;

  return (
    <div className="w-full">

      {/* Add New Marketplace Section - Show when adding new marketplaces */}
      {hasNewRows && (
        <div className="w-full">
          {/* Section Header */}
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add new marketplace...</h3>
          </div>

          {/* New Marketplace Rows */}
          <div className="w-full">
            {newMarketplaceRows.map((newRow) => (
              <NewSimpleRowComponent
                key={newRow.id}
                row={{ ...newRow, type: 'marketplace' }}
                isSelected={selectedMarketplaces.has(newRow.id)}
                onToggleSelection={() => onToggleMarketplaceSelection(newRow.id)}
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
        </div>
      )}

      {/* Marketplaces List - Show when there are marketplaces (hidden when adding new marketplaces) */}
      {!hasNewRows && totalMarketplaces > 0 && (
        <div className="w-full">
          {/* Bulk Actions Row - positioned like first category card */}
          <div className="w-full rounded-xl p-4 mb-3 bg-transparent border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              {/* Left side - Selection Count */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMarketplaces.size === totalMarketplaces && totalMarketplaces > 0}
                    onChange={() => onToggleAllMarketplacesSelection('all')}
                    className="h-4 w-4 rounded border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-2 transition-all flex-shrink-0 accent-purple-500"
                  />
                  <div className="text-sm sm:text-base font-medium text-gray-700 dark:text-slate-300">
                    {selectedMarketplaces.size}/{totalMarketplaces} Selected
                  </div>
                </div>
              </div>

              {/* Right side - Action Buttons */}
              <div className="flex items-center gap-2">
                {!hasAnySelection && (
                  <button
                    onClick={onAddNewMarketplaceRow}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                    title="Add New Marketplace"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="hidden sm:inline">Add Marketplace</span>
                  </button>
                )}
                
                {hasAnySelection && (
                  <>
                    <button
                      onClick={onBulkSave}
                      className="px-3 py-2 rounded-lg border border-purple-500 bg-purple-500 hover:bg-purple-600 text-white transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                      title="Save Changes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                      onClick={() => onToggleAllMarketplacesSelection(false)}
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

          {/* Marketplaces List */}
          <div className="space-y-3">
            {marketplaces.map((marketplace) => (
              <SimpleItemRow
                key={marketplace.id}
                item={marketplace}
                isSelected={selectedMarketplaces.has(marketplace.id)}
                onToggleSelection={() => onToggleMarketplaceSelection(marketplace.id)}
                onSave={() => onRefetch()}
                disabled={hasNewRows}
                isCheckboxDisabled={hasNewRows}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State - Show when no marketplaces and no new rows */}
      {totalMarketplaces === 0 && !hasNewRows && (
        <div className="px-4 py-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 text-center border border-gray-200 dark:border-gray-700/50">
            {/* Icon */}
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            
            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No marketplaces yet
            </h3>
            
            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Start building your marketplace database by adding your first marketplace.
            </p>
            
            {/* Action Button */}
            <button
              onClick={onAddNewMarketplaceRow}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Marketplace
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
