import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Navbar } from "./Navbar";

// Mock dependencies
jest.mock("@/context/WalletContext");
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: jest.fn() }),
}));
jest.mock("@/lib/constants", () => ({ NETWORK_NAME: "testnet" }));
jest.mock("lucide-react", () => {
  const mock = ({ children }: { children?: React.ReactNode }) => <span>{children}</span>;
  return new Proxy({}, { get: () => mock });
});

const { useWallet } = jest.requireMock("@/context/WalletContext") as {
  useWallet: jest.Mock;
};

const baseWallet = {
  address: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  signTx: jest.fn(),
  isConnecting: false,
  isAutoConnecting: false,
  error: null,
  networkMismatch: false,
  walletNetwork: null,
};

beforeEach(() => jest.clearAllMocks());

describe("Navbar", () => {
  it("shows Connect Wallet button when not connected", () => {
    useWallet.mockReturnValue(baseWallet);
    render(<Navbar />);
    expect(screen.getAllByRole("button", { name: /connect wallet/i })[0]).toBeInTheDocument();
  });

  it("shows truncated address and Disconnect when connected", () => {
    useWallet.mockReturnValue({
      ...baseWallet,
      address: "GABCDE12345WXYZ",
    });
    render(<Navbar />);
    expect(screen.getByText(/GABCD\.\.\.WXYZ/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /disconnect/i })[0]).toBeInTheDocument();
  });

  it("calls connect when Connect Wallet is clicked", async () => {
    const connect = jest.fn();
    useWallet.mockReturnValue({ ...baseWallet, connect });
    render(<Navbar />);
    await userEvent.click(screen.getAllByRole("button", { name: /connect wallet/i })[0]);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("calls disconnect when Disconnect is clicked", async () => {
    const disconnect = jest.fn();
    useWallet.mockReturnValue({ ...baseWallet, address: "GABCDE12345WXYZ", disconnect });
    render(<Navbar />);
    await userEvent.click(screen.getAllByRole("button", { name: /disconnect/i })[0]);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("displays error message when error is set", () => {
    useWallet.mockReturnValue({ ...baseWallet, error: "Wallet not found" });
    render(<Navbar />);
    expect(screen.getAllByText("Wallet not found")[0]).toBeInTheDocument();
  });
});
