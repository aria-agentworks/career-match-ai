"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      gap: "1rem",
      padding: "2rem",
      fontFamily: "system-ui, sans-serif",
    }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Something went wrong</h2>
      <p style={{ color: "#666", maxWidth: "500px", textAlign: "center" }}>
        {error.message || "An unexpected error occurred. Please try refreshing the page."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1.5rem",
          backgroundColor: "#000",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
