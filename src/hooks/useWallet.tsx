import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import type { Address } from "viem";
import { arcTestnet } from "@/lib/wagmi";

// Arc Testnet chain ID
export const ARC_CHAIN_ID = arcTestnet.id;

// Arc Network testnet config
export const ARC_TESTNET = {
  chainId: `0x${arcTestnet.id.toString(16)}`, // "0x4CEF52"
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.blockdaemon.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  connect: () => void;
  disconnect: () => void;
  switchToArc: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export { type Address } from "viem";

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting, chain } = useAccount();
  const { connect: connectWagmi, connectors } = useConnect();
  const { disconnect: disconnectWagmi } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const chainId = chain?.id ?? null;
  const isCorrectNetwork = chainId === ARC_CHAIN_ID;

  const switchToArc = useCallback(() => {
    if (switchChain && chainId !== ARC_CHAIN_ID) {
      switchChain({ chainId: ARC_CHAIN_ID });
    }
  }, [switchChain, chainId]);

  const connect = useCallback(() => {
    console.log("Available connectors:", connectors.map(c => ({ id: c.id, name: c.name })));

    // Find injected connector (MetaMask)
    const injectedConnector = connectors.find(
      (c) => c.id === "injected"
    );

    if (injectedConnector) {
      console.log("Found injected connector, connecting...");
      connectWagmi({ connector: injectedConnector });
    } else if (connectors.length > 0) {
      console.log("Using fallback connector:", connectors[0].id);
      connectWagmi({ connector: connectors[0] });
    } else {
      console.error("No connectors available!");
    }
  }, [connectors, connectWagmi]);

  const disconnect = useCallback(() => {
    disconnectWagmi();
  }, [disconnectWagmi]);

  const value: WalletState = {
    address: address ?? null,
    chainId: chainId ?? null,
    isConnected: isConnected ?? false,
    isConnecting: isConnecting ?? false,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToArc,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function shortAddress(addr: string | null | Address) {
  if (!addr) return "";
  const str = addr as string;
  return `${str.slice(0, 6)}…${str.slice(-4)}`;
}