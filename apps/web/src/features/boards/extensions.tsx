import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import type { EjectedComponent } from "./code-mode.js";
import type { BlockDefinition } from "./model.js";

/**
 * Optional hooks that other features (the dev-mode studio) plug into the board builder without
 * the boards feature depending on them.
 */
export interface BuilderExtensions {
  /**
   * "Eject" a built-in block into an editable custom component. Resolves to the created
   * component reference, or null when the user cancelled or nothing was created. When absent,
   * the inspector does not render the "Customize code" button.
   */
  readonly ejectBlock?: (block: BlockDefinition) => Promise<EjectedComponent | null>;
}

const noExtensions: BuilderExtensions = {};
const BuilderExtensionsContext = createContext<BuilderExtensions>(noExtensions);

export function BuilderExtensionsProvider({
  extensions,
  children,
}: {
  readonly extensions: BuilderExtensions;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <BuilderExtensionsContext.Provider value={extensions}>
      {children}
    </BuilderExtensionsContext.Provider>
  );
}

export function useBuilderExtensions(): BuilderExtensions {
  return useContext(BuilderExtensionsContext);
}
