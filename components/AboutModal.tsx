import React from 'react';
import Modal from './Modal';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <Modal title="About DocForge" onClose={onClose}>
      <div className="p-6 text-center text-text-main space-y-2">
        <p className="text-sm">© 2025 Tim Sinaeve. All rights reserved.</p>
        <a
          href="https://github.com/beNative/docforge"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-main hover:underline"
        >
          View source on GitHub
        </a>
      </div>
    </Modal>
  );
};

export default AboutModal;
