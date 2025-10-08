import React from 'react';
import Modal from './Modal';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <Modal title="About DocForge" onClose={onClose}>
      <div className="p-6 text-center text-text-main">
        <p className="text-sm">© 2025 Tim Sinaeve. All rights reserved.</p>
      </div>
    </Modal>
  );
};

export default AboutModal;
