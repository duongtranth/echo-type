export type FavoriteSelectionAction = 'add' | 'addFolder' | 'remove';

export function getFavoriteSelectionAction(
  existingFavorite: { folderIds: string[] } | undefined,
  selectedFolderId: string,
): FavoriteSelectionAction {
  if (!existingFavorite) return 'add';
  return existingFavorite.folderIds.includes(selectedFolderId) ? 'remove' : 'addFolder';
}
