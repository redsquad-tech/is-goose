// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from "../src/desktop/renderer/ui/components/index.js";
import { GooseIcon } from "../src/desktop/renderer/ui/icons/index.js";

describe("MUST satisfy core ui kit requirements", () => {
  it("MUST render core Button variants", () => {
    render(
      <div>
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
      </div>,
    );

    expect(screen.getByRole("button", { name: "Default" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Outline" })).toBeVisible();
  });

  it("MUST open and close Dialog content", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
          </DialogHeader>
          Dialog body
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Dialog body")).toBeVisible();
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(screen.queryByText("Dialog body")).not.toBeInTheDocument();
  });

  it("MUST toggle Switch and emit change", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="showMenuBarIcon" checked={false} onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole("switch", { name: "showMenuBarIcon" });
    fireEvent.click(control);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("MUST resolve core icon components", () => {
    render(<GooseIcon data-testid="goose-icon" />);

    expect(screen.getByTestId("goose-icon")).toBeVisible();
  });

  it("MUST render Input primitive", () => {
    render(<Input aria-label="keyboardShortcuts.openSettings" value="Ctrl+," readOnly />);

    expect(screen.getByLabelText("keyboardShortcuts.openSettings")).toHaveValue("Ctrl+,");
  });
});
