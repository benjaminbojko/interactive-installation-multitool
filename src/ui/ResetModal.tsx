import { useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';

interface Props {
  onClose: () => void;
}

export function ResetModal({ onClose }: Props) {
  const resetToDefaults = useConfigStore((s) => s.resetToDefaults);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = () => {
    resetToDefaults();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Reset all settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <strong>Reset all settings?</strong>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-disclaimer">
            <strong>This will reset all configuration back to defaults.</strong> Any
            adjustments across all tools (monitor placement, table, LED wall, projection,
            sensors, and speakers) stored locally in your browser will be cleared.
          </div>

          <div className="calib-actions">
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="danger" onClick={handleConfirm}>
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
