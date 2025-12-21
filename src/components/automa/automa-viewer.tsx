import { useEffect, useRef, useState } from "react";
import type { AutomaRegistry, AutomaMessageFromParent } from "@/types/automa";

interface AutomaViewerProps {
  automa: AutomaRegistry;
  values: Record<string, any>;
  isLive: boolean;
}

export function AutomaViewer({ automa, values, isLive }: AutomaViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const initializedRef = useRef(false);

  // Listen for ready message from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "automa:ready") {
        setIsReady(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send init message when iframe is ready
  useEffect(() => {
    if (isReady && iframeRef.current && !initializedRef.current) {
      const message: AutomaMessageFromParent = {
        type: "automa:init",
        payload: { values },
      };
      iframeRef.current.contentWindow?.postMessage(message, "*");
      initializedRef.current = true;
    }
  }, [isReady, values]);

  // Send updates when values change
  useEffect(() => {
    if (isReady && iframeRef.current && initializedRef.current) {
      const messageType = isLive ? "automa:update" : "automa:rebuild";
      const message: AutomaMessageFromParent = {
        type: messageType as any,
        payload: isLive ? { partialValues: values } : { values },
      };
      iframeRef.current.contentWindow?.postMessage(message, "*");
    }
  }, [values, isLive, isReady]);

  return (
    <div className="relative w-full h-full bg-background">
      <iframe
        ref={iframeRef}
        src={automa.renderer.path}
        className="w-full h-full border-0"
        title={automa.title}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      )}
    </div>
  );
}
