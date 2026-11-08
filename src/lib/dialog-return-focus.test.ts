import { describe, expect, it, vi } from "vitest";
import { restoreDialogFocus } from "./dialog-return-focus";

function environment() {
  let active: HTMLElement | null = null;
  const owner = {
    get activeElement() {
      return active;
    },
  };
  function target(
    options: {
      connected?: boolean;
      disabled?: boolean;
      visible?: boolean;
      acceptsFocus?: boolean;
    } = {},
  ) {
    const element = {
      isConnected: options.connected !== false,
      tabIndex: -1,
      matches: () => options.disabled === true,
      getClientRects: () => (options.visible === false ? [] : [{}]),
      hasAttribute: () => false,
      ownerDocument: owner,
      focus: vi.fn(() => {
        if (options.acceptsFocus !== false) active = node;
      }),
    };
    const node = element as unknown as HTMLElement;
    return { node, focus: element.focus, element };
  }
  return { target, owner };
}

describe("dialog return focus policy", () => {
  it("returns to an available trigger without scrolling", () => {
    const env = environment();
    const trigger = env.target();
    const heading = env.target();
    expect(restoreDialogFocus(trigger.node, heading.node)).toBe(true);
    expect(env.owner.activeElement).toBe(trigger.node);
    expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it.each([{ connected: false }, { disabled: true }, { visible: false }])(
    "falls back to the current heading when the trigger is unavailable: %j",
    (options) => {
      const env = environment();
      const trigger = env.target(options);
      const heading = env.target();
      expect(restoreDialogFocus(trigger.node, heading.node)).toBe(true);
      expect(trigger.focus).not.toHaveBeenCalled();
      expect(env.owner.activeElement).toBe(heading.node);
      expect(heading.focus).toHaveBeenCalledWith({ preventScroll: false });
      expect(heading.element.tabIndex).toBe(-1);
    },
  );

  it("falls back if a connected trigger refuses actual focus", () => {
    const env = environment();
    const trigger = env.target({ acceptsFocus: false });
    const heading = env.target();
    expect(restoreDialogFocus(trigger.node, heading.node)).toBe(true);
    expect(env.owner.activeElement).toBe(heading.node);
  });

  it("uses the current heading after the owner trigger ref disappears", () => {
    const env = environment();
    const heading = env.target();
    expect(restoreDialogFocus(null, heading.node)).toBe(true);
    expect(env.owner.activeElement).toBe(heading.node);
  });

  it("does not claim restoration or suppress native cleanup when no target exists", () => {
    expect(restoreDialogFocus(null, null)).toBe(false);
    const env = environment();
    const heading = env.target({ connected: false });
    expect(restoreDialogFocus(null, heading.node)).toBe(false);
    expect(heading.focus).not.toHaveBeenCalled();
  });
});
