import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchBox from "./SearchBox";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const { unoptimized: _unused, ...rest } = props;
    void _unused;
    return <img {...rest} />;
  },
}));

const ORBIT = { id: "UCdemooooooooooooooooooo", title: "Orbit Lab", description: "Science", thumbnail_url: null };
const BYTE = { id: "UCdemoffffffffffffffffff", title: "Byte Forge", description: "Code", thumbnail_url: null };

function mockSearch(results: unknown[], status = 200) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () =>
      new Response(JSON.stringify(status === 200 ? { results } : { detail: "quota" }), { status }),
    );
}

describe("SearchBox", () => {
  it("does not call the API while typing, only on submit", async () => {
    const fetchMock = mockSearch([ORBIT, BYTE]);
    render(<SearchBox onSelect={() => {}} />);
    const input = screen.getByRole("textbox", { name: /search youtube channels/i });
    await userEvent.type(input, "orbit");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/channels/search?q=orbit");
    expect(await screen.findByText("Orbit Lab")).toBeInTheDocument();
    expect(screen.getByText("Byte Forge")).toBeInTheDocument();
  });

  it("calls onSelect when a result is clicked", async () => {
    mockSearch([ORBIT, BYTE]);
    const onSelect = vi.fn();
    render(<SearchBox onSelect={onSelect} />);
    await userEvent.type(screen.getByRole("textbox"), "lab{Enter}");
    await userEvent.click(await screen.findByText("Byte Forge"));
    expect(onSelect).toHaveBeenCalledWith(BYTE);
  });

  it("selects a single handle match straight away with pickSingle", async () => {
    mockSearch([ORBIT]);
    const onSelect = vi.fn();
    render(<SearchBox onSelect={onSelect} pickSingle />);
    await userEvent.type(screen.getByRole("textbox"), "@orbitlab{Enter}");
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(ORBIT));
  });

  it("hides excluded channels", async () => {
    mockSearch([ORBIT, BYTE]);
    render(<SearchBox onSelect={() => {}} exclude={[ORBIT.id]} />);
    await userEvent.type(screen.getByRole("textbox"), "lab{Enter}");
    expect(await screen.findByText("Byte Forge")).toBeInTheDocument();
    expect(screen.queryByText("Orbit Lab")).not.toBeInTheDocument();
  });

  it("shows a quota message on 429", async () => {
    mockSearch([], 429);
    render(<SearchBox onSelect={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "anything{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/quota/i);
  });

  it("runs an example search from a chip", async () => {
    const fetchMock = mockSearch([ORBIT]);
    render(<SearchBox onSelect={() => {}} examples={["@orbitlab"]} />);
    await userEvent.click(screen.getByRole("button", { name: "@orbitlab" }));
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/channels/search?q=%40orbitlab");
  });
});
