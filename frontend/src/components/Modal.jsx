import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-none"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-dark-panel border border-dark-border shadow-2xl z-10 font-mono">
        <div className="box-panel-header px-4 py-3">
          <span className="text-xs font-semibold text-zinc-100">{title}</span>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
