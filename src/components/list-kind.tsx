"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the editor on screen belongs to a gift guide rather than somebody's
 * own wishlist.
 *
 * The add and edit panels are opened from several places deep inside the
 * editor, and on a guide they drop the controls that only make sense when
 * someone is buying for one person: cash, quantity, chipping in. Context
 * rather than a prop, so the rows in between don't have to carry it.
 *
 * Hiding a control here is only the courtesy. addGift and updateItem refuse
 * the same things on a guide whatever the form posts.
 */
const GuideContext = createContext(false);

export function ListKindProvider({
  guide,
  children,
}: {
  guide: boolean;
  children: ReactNode;
}) {
  return <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>;
}

export function useIsGuide(): boolean {
  return useContext(GuideContext);
}
