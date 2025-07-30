// src/diploma-gallery.js - Gallery functionality for diplomas page

export class DiplomaGallery {
  constructor() {
    this.modal = null;
    this.modalImage = null;
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupGallery());
    } else {
      this.setupGallery();
    }
  }

  setupGallery() {
    this.modal = document.getElementById('imageModal');
    this.modalImage = document.getElementById('modalImage');
    
    if (!this.modal || !this.modalImage) {
      console.warn('Modal elements not found');
      return;
    }

    // Add click listeners to all diploma items
    const diplomaItems = document.querySelectorAll('.diploma-item');
    diplomaItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const img = item.querySelector('.diploma-image');
        if (img) {
          this.openModal(img.src);
        }
      });
    });

    // Add close button listener
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // Close modal when clicking outside the image
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  openModal(imageSrc) {
    if (!this.modal || !this.modalImage) return;
    
    this.modal.classList.add('active');
    this.modalImage.src = imageSrc;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    if (!this.modal) return;
    
    this.modal.classList.remove('active');
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }
}

// Auto-initialize if we're on the qualifications page
if (window.location.pathname === '/kwalifikacje' || window.location.pathname.includes('kwalifikacje')) {
  new DiplomaGallery();
}