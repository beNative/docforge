import React from 'react';
import Modal from './Modal';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <Modal title="About DocForge" onClose={onClose}>
      <div className="p-6 space-y-6 text-text-main">
        <div className="space-y-3 text-center">
          <h3 className="text-2xl font-bold text-primary">DocForge</h3>
          <p className="text-sm text-text-secondary max-w-xl mx-auto">
            DocForge blends thoughtful interface design with dependable tooling to keep documentation projects moving forward.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-border-color bg-background/80 p-4 text-center shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary mb-2">Implementation</h4>
            <p className="text-base font-medium text-text-main">
              Implementation executed by <span className="font-semibold">Gemini 2.5 Pro</span> and <span className="font-semibold">gpt-5-codex</span>, delivering the engineered application experience.
            </p>
          </section>

          <section className="rounded-lg border border-border-color bg-background/80 p-4 text-center shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary mb-2">Interface Design</h4>
            <p className="text-base font-medium text-text-main">
              Interface polish provided with care by Tim Sinaeve.
            </p>
          </section>
        </div>

        <footer className="pt-4 border-t border-border-color text-center text-xs text-text-secondary">
          © 2025 DocForge Team. All rights reserved.
        </footer>
      </div>
    </Modal>
  );
};

export default AboutModal;
