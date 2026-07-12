import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OtpInput } from "./OtpInput";

function renderControlled(initialValue = "") {
  let value = initialValue;
  const onChange = vi.fn((next: string) => {
    value = next;
  });
  const { rerender } = render(<OtpInput value={value} onChange={onChange} />);
  return {
    onChange,
    rerenderWith: (next: string) => {
      value = next;
      rerender(<OtpInput value={value} onChange={onChange} />);
    },
  };
}

describe("OtpInput", () => {
  it("renders 6 digit boxes, each with a distinct position aria-label", () => {
    render(<OtpInput value="" onChange={() => {}} />);

    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Code digit ${i} of 6`)).toBeInTheDocument();
    }
  });

  it("auto-advances focus to the next box after a digit is entered", async () => {
    const user = userEvent.setup();
    const { onChange, rerenderWith } = renderControlled();

    const first = screen.getByLabelText("Code digit 1 of 6");
    await user.type(first, "1");

    expect(onChange).toHaveBeenCalledWith("1");
    rerenderWith("1");

    expect(screen.getByLabelText("Code digit 2 of 6")).toHaveFocus();
  });

  it("auto-backs focus to the previous box on backspace when the current box is empty", async () => {
    const user = userEvent.setup();
    renderControlled("1");

    const second = screen.getByLabelText("Code digit 2 of 6");
    second.focus();
    await user.keyboard("{Backspace}");

    expect(screen.getByLabelText("Code digit 1 of 6")).toHaveFocus();
  });

  it("fills all boxes when a 6-digit string is pasted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);

    const first = screen.getByLabelText("Code digit 1 of 6");
    first.focus();
    await user.paste("123456");

    expect(onChange).toHaveBeenCalledWith("123456");
  });
});
