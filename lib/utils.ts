import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  assetCode: string = "USD",
  assetScale: number = 2
): string {
  const value = amount / Math.pow(10, assetScale);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: assetCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: assetScale,
  }).format(value);
}

export function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function parseWalletAddress(input: string): string {
  if (!input) return input;
  
  // Normalize: trim and remove duplicate protocols/spaces
  let normalized = input.trim();
  
  // Remove spaces after protocols
  normalized = normalized.replace(/https:\/\/\s+/g, "https://");
  normalized = normalized.replace(/http:\/\/\s+/g, "http://");
  
  // Remove duplicate protocols
  normalized = normalized.replace(/https:\/\/https:\/\//g, "https://");
  normalized = normalized.replace(/http:\/\/https:\/\//g, "https://");
  normalized = normalized.replace(/https:\/\/http:\/\//g, "https://");
  
  // Convert payment pointer format ($wallet.example/alice) to URL
  if (normalized.startsWith("$")) {
    return `https://${normalized.slice(1)}`;
  }
  // Already a URL
  if (normalized.startsWith("https://") || normalized.startsWith("http://")) {
    // Normalize http:// to https://
    if (normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      return normalized.replace("http://", "https://");
    }
    return normalized;
  }
  // Assume it's a domain/path and add https://
  return `https://${normalized}`;
}

export function generateSessionCode(length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isValidWalletAddress(address: string): boolean {
  // Basic validation for wallet address format
  const url = parseWalletAddress(address);
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

