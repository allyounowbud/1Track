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
    <section className={`${pageCard} mb-6`}>
      {/* Card Header - Match SettingsCard exactly */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap rounded-xl p-2 -m-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-[2.25rem]">Marketplaces</h2>
          <p className="text-xs text-gray-600 dark:text-slate-400 -mt-1">Total: {totalMarketplaces}</p>
        </div>
      </div>

      {/* Expanded Content - Only show when there are marketplaces or new rows */}
      {(totalMarketplaces > 0 || hasNewRows) && (
        <div className="pt-5 border-t border-gray-200 dark:border-slate-800 mt-4 overflow-visible">
          {/* Header with Selection Count and Actions - Match SettingsCard exactly */}
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-4">
            <div className="flex items-center gap-3">
              {hasAnySelection && (
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  {selectedMarketplaces.size} selected
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {hasNewRows ? (
                <>
                  <button
                    onClick={onBulkSave}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Save Changes"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      newMarketplaceRows.forEach(row => onRemoveNewRow(row.id));
                      onToggleAllMarketplacesSelection(false);
                    }}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Cancel Changes"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : hasAnySelection ? (
                <>
                  <button
                    onClick={() => onToggleAllMarketplacesSelection(false)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Cancel Selection"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={onBulkSave}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Save Selected"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  </button>
                  <button
                    onClick={onBulkDelete}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Delete Selected"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  onClick={onAddNewMarketplaceRow}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                  title="Add New Marketplace"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              )}
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
            
            {/* New Marketplace Rows */}
            {newMarketplaceRows.map((newRow) => (
              <NewSimpleRowComponent
                key={newRow.id}
                newRow={newRow}
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

      {/* Empty State - Show when no marketplaces and no new rows */}
      {totalMarketplaces === 0 && !hasNewRows && (
        <div className="pt-5 border-t border-gray-200 dark:border-slate-800 mt-4">
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-slate-400 text-lg mb-4">No marketplaces yet</div>
            <div className="text-slate-500 text-sm">
              Start building your marketplace database by{" "}
              <button
                onClick={onAddNewMarketplaceRow}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer transition-colors"
              >
                + adding
              </button>{" "}
              your first marketplace
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
