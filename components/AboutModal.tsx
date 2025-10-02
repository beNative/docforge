import React from 'react';
import Modal from './Modal';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <Modal title="About DocForge" onClose={onClose}>
      <div className="p-6 space-y-6 text-text-main">
        <div className="text-center space-y-2">
          <span className="uppercase text-[11px] tracking-[0.4em] text-text-secondary">Design &amp; Concept</span>
          <h3 className="text-2xl font-bold text-primary">Tim Sinaeve</h3>
          <p className="text-sm text-text-secondary max-w-xl mx-auto">
            The DocForge experience was envisioned and artfully directed by Tim Sinaeve, whose design leadership shaped the product's concept and presentation.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-border-color bg-background/80 p-4 text-center shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary mb-2">Creative Direction</h4>
            <p className="text-base font-medium text-text-main">
              Tim Sinaeve guided the visual system, interaction model, and product narrative that define DocForge.
            </p>
          </section>

          <section className="rounded-lg border border-border-color bg-background/80 p-4 text-center shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary mb-2">Implementation</h4>
            <p className="text-base font-medium text-text-main">
              Implementation executed by <span className="font-semibold">Gemini 2.5 Pro</span> and <span className="font-semibold">gpt-5-codex</span>, delivering the engineered application experience.
            </p>
          </section>
        </div>

        <p className="text-sm text-text-main text-center max-w-2xl mx-auto">
          Design and concept were created by Tim Sinaeve, with implementation meticulously handled by Gemini 2.5 Pro and gpt-5-codex to ensure a reliable, production-ready platform.
        </p>

        <footer className="pt-4 border-t border-border-color text-center text-xs text-text-secondary">
          © 2025 Tim Sinaeve. All rights reserved.
        </footer>
      </div>
    </Modal>
  );
};

export default AboutModal;
