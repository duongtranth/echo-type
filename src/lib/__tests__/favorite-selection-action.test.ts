import { describe, expect, it } from 'vitest';
import { getFavoriteSelectionAction } from '@/lib/favorite-selection-action';

describe('getFavoriteSelectionAction', () => {
  it('adds a new favorite to the selected folder', () => {
    expect(getFavoriteSelectionAction(undefined, 'folder-a')).toBe('add');
  });

  it('adds the selected folder to an existing favorite that is not in it yet', () => {
    expect(getFavoriteSelectionAction({ folderIds: ['auto'] }, 'folder-a')).toBe('addFolder');
  });

  it('removes an existing favorite from a folder it is already in', () => {
    expect(getFavoriteSelectionAction({ folderIds: ['folder-a'] }, 'folder-a')).toBe('remove');
  });

  it('removes from a folder even when the favorite belongs to several folders', () => {
    expect(getFavoriteSelectionAction({ folderIds: ['folder-a', 'auto'] }, 'folder-a')).toBe('remove');
  });
});
