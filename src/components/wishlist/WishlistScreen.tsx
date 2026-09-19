import type { WishlistNavigation } from './navigation';
import type { WishlistItem } from './item';
import WishlistList from './WishlistList';
import WishlistDetail from './WishlistDetail';
import WishlistCreate from './WishlistCreate';
import WishlistComplete from './WishlistComplete';
import type { SaveEntryFormData } from './SavingBottomSheet';
import type { CreateWishlistGoalData } from './data';

interface WishlistScreenProps {
  nav: WishlistNavigation;
  items: WishlistItem[];
  onSelectItem: (id: string) => void;
  onBackToList: () => void;
  onAddSaving: () => void;
  onCreate: (data: CreateWishlistGoalData) => void;
  onShare: () => void;
  onDelete: () => void;
  onNewGoal: () => void;
  shareSupported: boolean;
  isSavingOpen?: boolean;
  onCloseSaving?: () => void;
  onSaveSaving?: (data: SaveEntryFormData) => void;
}

export function WishlistScreen({
  nav,
  items,
  onSelectItem,
  onBackToList,
  onAddSaving,
  onCreate,
  onShare,
  onDelete,
  onNewGoal,
  shareSupported,
  isSavingOpen = false,
  onCloseSaving = () => {},
  onSaveSaving = () => {},
}: WishlistScreenProps) {
  const renderList = () => (
    <div className="pb-12">
      {items.length === 0 ? (
        <WishlistCreate onChangeGoal={onCreate} />
      ) : (
        <WishlistList items={items} onSelect={onSelectItem} />
      )}
    </div>
  );

  if (nav.view === 'detail') {
    const selected = items.find((item) => item.id === nav.selectedWishlistId) ?? null;
    if (!selected) {
      return renderList();
    }
    if (selected.remaining <= 0) {
      return (
        <div className="pb-12">
          <WishlistComplete
            item={selected}
            shareSupported={shareSupported}
            onBack={onBackToList}
            onShare={onShare}
            onDelete={onDelete}
            onNewGoal={onNewGoal}
          />
        </div>
      );
    }
    return (
      <div className="pb-12">
        <WishlistDetail
          item={selected}
          onBack={onBackToList}
          onAddSaving={onAddSaving}
          onShare={onShare}
          onDelete={onDelete}
          shareSupported={shareSupported}
          isSavingOpen={isSavingOpen}
          onCloseSaving={onCloseSaving}
          onSaveSaving={onSaveSaving}
        />
      </div>
    );
  }

  return renderList();
}