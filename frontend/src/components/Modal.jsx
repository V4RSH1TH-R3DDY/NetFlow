import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[101]"
          >
            <div className="bg-dark-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
              {/* Bezel Overlay */}
              <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-2xl" />
              
              <div className="p-6 border-b border-dark-border flex justify-between items-center bg-dark-surface/50">
                <h3 className="text-xs font-bold text-white tracking-[0.2em] uppercase">{title}</h3>
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Modal;
