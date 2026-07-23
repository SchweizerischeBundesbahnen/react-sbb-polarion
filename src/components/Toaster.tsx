import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

/**
 * The shared app-wide toast host: sonner's `Toaster` preconfigured with the standard SBB Polarion look
 * every extension uses - top-center, `richColors` (green success with a checkmark, red errors, amber
 * warnings) and a 5s duration. Mount it once near the app root; fire toasts with `toast()` imported
 * from `sonner` directly (this only centralizes the host's styling, not the calls).
 *
 * `sonner` is a peer dependency of react-sbb-polarion, so the consuming app supplies the single sonner
 * instance (same pattern as react/react-dom); it is not bundled into the library.
 *
 * Any prop can be overridden (they spread after the defaults), but keep the defaults unless there is a
 * concrete reason to diverge - the point is one consistent toast style across every extension.
 */
export default function Toaster(props: ToasterProps) {
  return <SonnerToaster position="top-center" richColors duration={5000} {...props} />;
}
