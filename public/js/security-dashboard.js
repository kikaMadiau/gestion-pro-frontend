// security-dashboard.js — Liste des visites pour le poste sécurité (/security)
// Version corrigée et optimisée avec URL endpoint correcte (sans /api)

// ==================== CONFIGURATION ====================
const SECURITY_CONFIG = {
    API: {
        BASE_URL: window.ENV?.API_BASE_URL || 'http://127.0.0.1:8000',
        DASHBOARD_VISITS: '/api/audiences/dashboard/security',
        CHECKIN_VERIFY: '/audiences/{id}/security'
    },
    UI: {
        REFRESH_INTERVAL: 30000, // 30 secondes
        TOAST_DURATION: 3000,
        PHOTO_QUALITY: 0.92
    }
};

// ==================== UTILITAIRES ====================
const SecurityUtils = {
    /**
     * Échappe les caractères HTML pour prévenir XSS
     */
    escapeHtml(text) {
        if (!text) return '—';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
    },

    /**
     * Formate une date pour l'affichage
     */
    formatDate(dateString) {
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch {
            return '—';
        }
    },

    /**
     * Extrait le prénom et nom d'un nom complet
     */
    extractNames(fullName) {
        if (!fullName) return { firstName: '—', lastName: '—' };
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 0) return { firstName: '—', lastName: '—' };
        if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
        return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    },

    /**
     * Normalise l'ID pour l'URL de check-in
     */
    toAudienceCheckinPathId(rawId) {
        if (!rawId) return '';
        const s = String(rawId).trim();
        if (/^0x[0-9a-fA-F]+$/i.test(s)) return s;
        const hex = s.replace(/-/g, '');
        if (/^[0-9a-fA-F]{32}$/i.test(hex)) return `0x${hex.toUpperCase()}`;
        return encodeURIComponent(s);
    },

    /**
     * Récupère le token d'authentification
     */
    getAuthToken() {
        return localStorage.getItem('authToken');
    },

    /**
     * Vérifie si l'utilisateur a accès à la page sécurité
     */
    hasSecurityAccess() {
        if (typeof window.isSecurityUser === 'function') {
            return window.isSecurityUser();
        }
        if (typeof window.readStoredRoles !== 'function') {
            return false;
        }
        const roles = window.readStoredRoles();
        return Array.isArray(roles) && 
               roles.some(r => (r || '').toString().toUpperCase().includes('SECURITY'));
    },

    /**
     * Récupère l'ID de visite depuis le modal
     */
    getCurrentVisitId() {
        return document.getElementById('security-checkin-visit-id')?.value?.trim() || '';
    },

    /**
     * Crée l'URL de check-in pour une audience (CORRIGÉE - sans /api)
     */
    getCheckinUrl(visitId) {
        const normalizedId = this.toAudienceCheckinPathId(visitId);
        // URL correcte: http://127.0.0.1:8000/audiences/{id}/verify (sans /api)
        const url = `${SECURITY_CONFIG.API.BASE_URL}${SECURITY_CONFIG.API.CHECKIN_VERIFY.replace('{id}', normalizedId)}`;
        console.debug('Checkin URL générée:', url);
        return url;
    }
};

// ==================== GESTION DES MODALS ====================
class ModalManager {
    static showModal(modalElement) {
        if (!modalElement) return;
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
                modal.show();
                return;
            } catch (e) {
                console.warn('Bootstrap modal error:', e);
            }
        }
        
        // Fallback manuel
        modalElement.classList.add('show');
        modalElement.style.display = 'block';
        modalElement.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');
        
        // Ajouter backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
    }
    
    static hideModal(modalElement) {
        if (!modalElement) return;
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                    return;
                }
            } catch (e) {
                console.warn('Bootstrap modal error:', e);
            }
        }
        
        // Fallback manuel
        modalElement.classList.remove('show');
        modalElement.style.display = 'none';
        modalElement.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        
        // Supprimer backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
    }
}

// ==================== NOTIFICATIONS ====================
class NotificationService {
    static showToast(message, type = 'info', duration = SECURITY_CONFIG.UI.TOAST_DURATION) {
        const container = document.getElementById('security-toast-container');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `security-toast alert alert-${this._getAlertClass(type)}`;
        toast.style.cssText = `
            min-width: 220px;
            margin-bottom: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease;
            z-index: 9999;
        `;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'opacity 300ms';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, duration);
    }
    
    static showError(message) {
        this.showToast(message, 'error');
    }
    
    static showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    static showInfo(message) {
        this.showToast(message, 'info');
    }
    
    static _getAlertClass(type) {
        switch(type) {
            case 'error': return 'danger';
            case 'success': return 'success';
            default: return 'info';
        }
    }
}

// ==================== GESTION DES PHOTOS ====================
class PhotoManager {
    constructor() {
        this.visitorPhoto = null;
        this.identityPhoto = null;
        this.activeStream = null;
        this.activeCaptureType = null;
        this._tempCapture = null;
    }
    
    setVisitorPhoto(blob) {
        this.visitorPhoto = blob;
        this._updatePreviews();
        this._updateSubmitButton();
    }
    
    setIdentityPhoto(blob) {
        this.identityPhoto = blob;
        this._updatePreviews();
        this._updateSubmitButton();
    }
    
    clearVisitorPhoto() {
        if (this.visitorPhoto) {
            this._revokeBlobUrls();
            this.visitorPhoto = null;
        }
        this._updatePreviews();
        this._updateSubmitButton();
        NotificationService.showInfo('Photo visiteur retirée');
    }
    
    clearIdentityPhoto() {
        if (this.identityPhoto) {
            this._revokeBlobUrls();
            this.identityPhoto = null;
        }
        this._updatePreviews();
        this._updateSubmitButton();
        NotificationService.showInfo('Photo pièce retirée');
    }
    
    hasBothPhotos() {
        return !!(this.visitorPhoto && this.identityPhoto);
    }
    
    _revokeBlobUrls() {
        // Nettoyer les URLs blob existantes
        const previews = document.querySelectorAll('[data-blob-url]');
        previews.forEach(el => {
            const url = el.getAttribute('data-blob-url');
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
            el.removeAttribute('data-blob-url');
        });
    }
    
    _updatePreviews() {
        // Mise à jour preview visiteur
        this._updateSinglePreview('visitor', this.visitorPhoto);
        this._updateSinglePreview('identity', this.identityPhoto);
        
        // Mise à jour des boutons remove
        const remV = document.getElementById('security-checkin-remove-visitor');
        const remI = document.getElementById('security-checkin-remove-identity');
        if (remV) remV.classList.toggle('d-none', !this.visitorPhoto);
        if (remI) remI.classList.toggle('d-none', !this.identityPhoto);
    }
    
    _updateSinglePreview(type, blob) {
        const previewImg = document.getElementById(`security-checkin-preview-${type}`);
        const placeholder = document.getElementById(`security-checkin-placeholder-${type}`);
        const cardImg = document.getElementById(`security-checkin-card-${type}-img`);
        
        if (!previewImg) return;
        
        if (blob) {
            const url = URL.createObjectURL(blob);
            previewImg.src = url;
            previewImg.setAttribute('data-blob-url', url);
            previewImg.classList.remove('d-none');
            if (placeholder) placeholder.classList.add('d-none');
            if (cardImg) {
                cardImg.src = url;
                cardImg.setAttribute('data-blob-url', url);
            }
        } else {
            previewImg.src = '';
            previewImg.classList.add('d-none');
            if (placeholder) placeholder.classList.remove('d-none');
            if (cardImg) cardImg.src = '';
        }
    }
    
    _updateSubmitButton() {
        const submitBtn = document.getElementById('security-checkin-submit');
        if (submitBtn) {
            submitBtn.disabled = !this.hasBothPhotos();
        }
    }
    
    reset() {
        this.clearVisitorPhoto();
        this.clearIdentityPhoto();
        this.stopCamera();
        this._tempCapture = null;
    }
    
    async startCamera(type) {
        this.stopCamera();
        this.activeCaptureType = type;
        
        const videoElement = document.getElementById(type === 'visitor' ? 'video_inline' : 'scannerVideo_inline');
        if (!videoElement) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.activeStream = stream;
            videoElement.srcObject = stream;
            await videoElement.play();
            
            // Activer le bouton capture
            const captureBtn = document.getElementById(type === 'visitor' ? 'captureBtn_inline' : 'docCapture_inline');
            if (captureBtn) captureBtn.disabled = false;
            
            NotificationService.showInfo('Caméra démarrée', 'info', 2000);
        } catch (error) {
            console.error('Camera error:', error);
            NotificationService.showError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        }
    }
    
    stopCamera() {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(track => track.stop());
            this.activeStream = null;
        }
        
        // Réinitialiser les éléments vidéo
        ['video_inline', 'scannerVideo_inline'].forEach(id => {
            const video = document.getElementById(id);
            if (video && video.srcObject) {
                video.srcObject = null;
            }
        });
        
        this.activeCaptureType = null;
    }
    
    async capturePhoto(type) {
        const videoId = type === 'visitor' ? 'video_inline' : 'scannerVideo_inline';
        const canvasId = type === 'visitor' ? 'canvas_inline' : 'scannerCanvas_inline';
        
        const video = document.getElementById(videoId);
        const canvas = document.getElementById(canvasId);
        
        if (!video || !canvas || video.videoWidth === 0) {
            NotificationService.showError('Caméra non prête');
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Masquer vidéo, montrer canvas
        video.classList.add('d-none');
        canvas.classList.remove('d-none');
        
        // Afficher boutons retake/save
        const captureBtn = document.getElementById(type === 'visitor' ? 'captureBtn_inline' : 'docCapture_inline');
        const retakeBtn = document.getElementById(type === 'visitor' ? 'retakeBtn_inline' : 'docRetake_inline');
        const saveBtn = document.getElementById(type === 'visitor' ? 'saveBtn_inline' : 'docSave_inline');
        
        if (captureBtn) captureBtn.classList.add('d-none');
        if (retakeBtn) retakeBtn.classList.remove('d-none');
        if (saveBtn) saveBtn.classList.remove('d-none');
        
        // Stocker temporairement pour validation
        this._tempCapture = { canvas, type };
    }
    
    retakePhoto() {
        if (!this._tempCapture) return;
        
        const { canvas, type } = this._tempCapture;
        const videoId = type === 'visitor' ? 'video_inline' : 'scannerVideo_inline';
        
        const video = document.getElementById(videoId);
        canvas.classList.add('d-none');
        video.classList.remove('d-none');
        
        // Réinitialiser boutons
        const captureBtn = document.getElementById(type === 'visitor' ? 'captureBtn_inline' : 'docCapture_inline');
        const retakeBtn = document.getElementById(type === 'visitor' ? 'retakeBtn_inline' : 'docRetake_inline');
        const saveBtn = document.getElementById(type === 'visitor' ? 'saveBtn_inline' : 'docSave_inline');
        
        if (captureBtn) captureBtn.classList.remove('d-none');
        if (retakeBtn) retakeBtn.classList.add('d-none');
        if (saveBtn) saveBtn.classList.add('d-none');
        
        this._tempCapture = null;
    }
    
    async savePhoto() {
        if (!this._tempCapture) return;
        
        const { canvas, type } = this._tempCapture;
        const mimeType = type === 'visitor' ? 'image/jpeg' : 'image/png';
        const quality = type === 'visitor' ? SECURITY_CONFIG.UI.PHOTO_QUALITY : undefined;
        
        canvas.toBlob((blob) => {
            if (!blob) {
                NotificationService.showError('Erreur lors de la capture');
                return;
            }
            
            if (type === 'visitor') {
                this.setVisitorPhoto(blob);
            } else {
                this.setIdentityPhoto(blob);
            }
            
            this.hideCaptureInterface(type);
            NotificationService.showSuccess(`Photo ${type === 'visitor' ? 'visiteur' : 'pièce'} enregistrée`);
            this._tempCapture = null;
        }, mimeType, quality);
    }
    
    hideCaptureInterface(type) {
        const areaId = type === 'visitor' ? 'inline-photo-capture' : 'inline-id-capture';
        const area = document.getElementById(areaId);
        if (area) area.classList.add('d-none');
        
        // Réinitialiser l'interface
        const videoId = type === 'visitor' ? 'video_inline' : 'scannerVideo_inline';
        const canvasId = type === 'visitor' ? 'canvas_inline' : 'scannerCanvas_inline';
        
        const video = document.getElementById(videoId);
        const canvas = document.getElementById(canvasId);
        
        if (video) video.classList.remove('d-none');
        if (canvas) canvas.classList.add('d-none');
        
        // Réinitialiser boutons
        const captureBtn = document.getElementById(type === 'visitor' ? 'captureBtn_inline' : 'docCapture_inline');
        const retakeBtn = document.getElementById(type === 'visitor' ? 'retakeBtn_inline' : 'docRetake_inline');
        const saveBtn = document.getElementById(type === 'visitor' ? 'saveBtn_inline' : 'docSave_inline');
        
        if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.classList.remove('d-none');
        }
        if (retakeBtn) retakeBtn.classList.add('d-none');
        if (saveBtn) saveBtn.classList.add('d-none');
        
        this.stopCamera();
    }
}

// ==================== GESTION DES VISITES ====================
class VisitsManager {
    constructor() {
        this.visits = [];
        this.refreshInterval = null;
    }
    
    async loadVisits() {
        if (!SecurityUtils.hasSecurityAccess()) {
            this._showAccessDenied();
            return;
        }
        
        const token = SecurityUtils.getAuthToken();
        if (!token) {
            this._showAccessDenied();
            return;
        }
        
        const tbody = document.getElementById('security-visits-tbody');
        if (!tbody) return;
        
        this._showLoading(tbody);
        
        try {
            const url = `${SECURITY_CONFIG.API.BASE_URL}${SECURITY_CONFIG.API.DASHBOARD_VISITS}`;
            console.debug('Loading visits from:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this._showSessionExpired(tbody);
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.visits = data.data || data.audiences || [];
            
            if (!Array.isArray(this.visits) || this.visits.length === 0) {
                this._showEmptyState(tbody, data);
                return;
            }
            
            this._renderVisits(tbody);
        } catch (error) {
            console.error('Load visits error:', error);
            this._showError(tbody, error.message);
        }
    }
    
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(() => this.loadVisits(), SECURITY_CONFIG.UI.REFRESH_INTERVAL);
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    _showLoading(tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center py-4">
                    <div class="spinner-border text-primary"></div>
                    <br>Chargement...
                </td>
            </tr>
        `;
    }
    
    _showAccessDenied() {
        const tbody = document.getElementById('security-visits-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center text-danger py-4">
                        Accès refusé — rôle sécurité requis.
                    </td>
                </tr>
            `;
        }
    }
    
    _showSessionExpired(tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-danger py-4">
                    Session expirée. Veuillez vous reconnecter.
                </td>
            </tr>
        `;
    }
    
    _showEmptyState(tbody, data) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-muted py-4">
                    Aucune visite pour ce poste.
                    <pre style="text-align:left;white-space:pre-wrap;background:#f8f9fa;border-radius:4px;padding:8px;margin-top:8px;max-height:240px;overflow:auto;">
                        ${SecurityUtils.escapeHtml(JSON.stringify(data || {}, null, 2))}
                    </pre>
                </td>
            </tr>
        `;
    }
    
    _showError(tbody, message) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-danger py-4">
                    Erreur lors du chargement des données: ${SecurityUtils.escapeHtml(message)}
                </td>
            </tr>
        `;
    }
    
    _renderVisits(tbody) {
        tbody.innerHTML = this.visits.map((visit, index) => this._renderVisitRow(visit, index)).join('');
    }
    
    _renderVisitRow(visit, index) {
        const { firstName, lastName } = SecurityUtils.extractNames(visit.visitor_name);
        const scheduledDate = SecurityUtils.formatDate(visit.scheduled_at);
        const statusBadge = this._getStatusBadge(visit.status);
        const email = SecurityUtils.escapeHtml(visit.employee || visit.employee_email || '—');
        const phone = SecurityUtils.escapeHtml(visit.visitor_phone || visit.phone || '—');
        const avatarIndex = (index % 8) + 1;
        const visitId = SecurityUtils.escapeHtml(String(visit.id || ''));
        
        return `
            <tr data-visit-id="${visitId}">
                <td class="col-auto">
                    <div class="avatar avatar-md">
                        <img src="/public/images/faces/${avatarIndex}.jpg" alt="Avatar">
                    </div>
                </td>
                <td class="col-auto"><p class="mb-0">${SecurityUtils.escapeHtml(firstName)}</p></td>
                <td class="col-auto"><p class="mb-0">${SecurityUtils.escapeHtml(lastName)}</p></td>
                <td class="col-auto"><p class="mb-0">${email}</p></td>
                <td class="col-auto"><p class="mb-0">${phone}</p></td>
                <td class="col-auto"><p class="mb-0 text-center">${scheduledDate}</p></td>
                <td class="col-auto text-center">${statusBadge}</td>
                <td class="col-auto"><p class="mb-0">—</p></td>
                <td class="col-auto"><p class="mb-0">—</p></td>
                <td class="col-auto"><p class="mb-0">—</p></td>
                <td class="col-auto text-center action-button-custom">
                    <div class="dropdown">
                        <button class="btn btn-outline-primary dropdown-toggle me-1" 
                                type="button" 
                                id="secDropdown_${visitId}" 
                                data-bs-toggle="dropdown" 
                                aria-expanded="false">
                            Actions <i class="bi bi-caret-down-fill"></i>
                        </button>
                        <div class="dropdown-menu" aria-labelledby="secDropdown_${visitId}">
                            <a class="dropdown-item security-complete-form-btn" 
                               href="#" 
                               data-visit-id="${visitId}">
                                <i class="bi bi-pencil-square"></i> Compléter formulaire
                            </a>
                            <a class="dropdown-item" 
                               href="#" 
                               data-bs-toggle="modal" 
                               data-bs-target="#validation-security-modal" 
                               data-visit-id="${visitId}">
                                <i class="bi bi-check-circle"></i> Valider Sécurité
                            </a>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }
    
    _getStatusBadge(status) {
        const statusMap = {
            'REGISTERED': { label: 'Enregistré', color: 'bg-info' },
            'PENDING': { label: 'En attente', color: 'bg-warning text-dark' },
            'CONFIRMED': { label: 'Confirmé', color: 'bg-success' },
            'VERIFIED': { label: 'Vérifié', color: 'bg-success' },
            'CHECKED': { label: 'Contrôlé', color: 'bg-primary' },
            'APPROVED': { label: 'Approuvé', color: 'bg-success' },
            'DELAYED': { label: 'Retardé', color: 'bg-danger' },
            'COMPLETED': { label: 'Complété', color: 'bg-success' },
            'CANCELLED': { label: 'Annulé', color: 'bg-secondary text-dark' }
        };
        
        const config = statusMap[status] || { label: status || 'Inconnu', color: 'bg-secondary' };
        return `<span class="badge ${config.color}">${config.label}</span>`;
    }
}

// ==================== SERVICE DE CHECK-IN ====================
class CheckinService {
    constructor(photoManager) {
        this.photoManager = photoManager;
    }
    
    async submitCheckin(visitId) {
        if (!visitId) {
            NotificationService.showError('ID de visite manquant');
            return false;
        }
        
        if (!this.photoManager.hasBothPhotos()) {
            NotificationService.showError('Les deux photos sont requises');
            return false;
        }
        
        const token = SecurityUtils.getAuthToken();
        if (!token) {
            NotificationService.showError('Session expirée');
            return false;
        }
        
        const submitBtn = document.getElementById('security-checkin-submit');
        const errorEl = document.getElementById('security-checkin-error');
        
        if (submitBtn) submitBtn.disabled = true;
        if (errorEl) errorEl.classList.add('d-none');
        
        try {
            const formData = new FormData();
            formData.append('visitor_photo', this.photoManager.visitorPhoto, 'visitor.jpg');
            formData.append('id_photo', this.photoManager.identityPhoto, 'identity.png');
            
            // URL CORRECTE: sans /api
            const url = SecurityUtils.getCheckinUrl(visitId);
            console.debug('Submitting checkin to:', url);
            console.debug('FormData contents:', {
                visitor_photo: this.photoManager.visitorPhoto?.name,
                id_photo: this.photoManager.identityPhoto?.name
            });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const responseText = await response.text();
            let data = {};
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.warn('Response not JSON:', responseText);
            }
            
            if (response.ok) {
                NotificationService.showSuccess(data.message || 'Photos enregistrées avec succès');
                this._resetAndClose();
                return true;
            } else {
                this._handleError(response.status, data, responseText, url);
                return false;
            }
        } catch (error) {
            console.error('Submit error:', error);
            NotificationService.showError('Erreur réseau ou serveur');
            return false;
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }
    
    _handleError(status, data, responseText, url) {
        const errorEl = document.getElementById('security-checkin-error');
        if (!errorEl) {
            NotificationService.showError(data.message || `Erreur ${status}`);
            return;
        }
        
        const message = data.message || data.detail || `Erreur ${status}`;
        const diagnostic = `
            URL: ${url}
            Statut: ${status}
            Réponse: ${responseText}
        `;
        
        errorEl.classList.remove('d-none');
        errorEl.innerHTML = `
            <div class="alert alert-danger">
                <strong>${SecurityUtils.escapeHtml(message)}</strong>
                <pre class="mt-2 mb-0 small" style="white-space: pre-wrap;">${SecurityUtils.escapeHtml(diagnostic)}</pre>
                <button class="btn btn-sm btn-outline-danger mt-2" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">
                    Copier le diagnostic
                </button>
            </div>
        `;
    }
    
    _resetAndClose() {
        const visitIdInput = document.getElementById('security-checkin-visit-id');
        if (visitIdInput) visitIdInput.value = '';
        
        this.photoManager.reset();
        ModalManager.hideModal(document.getElementById('security-checkin-modal'));
        
        // Recharger la liste des visites
        setTimeout(() => window.visitsManager?.loadVisits(), 600);
    }
}

// ==================== INITIALISATION UI ====================
class SecurityDashboardUI {
    constructor(photoManager, checkinService) {
        this.photoManager = photoManager;
        this.checkinService = checkinService;
        this.isWired = false;
    }
    
    init() {
        if (!SecurityUtils.hasSecurityAccess()) {
            return;
        }
        
        this.wireEvents();
    }
    
    wireEvents() {
        if (this.isWired) return;
        this.isWired = true;
        
        // Boutons de complétion formulaire
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('.security-complete-form-btn');
            if (btn) {
                e.preventDefault();
                const visitId = btn.getAttribute('data-visit-id');
                if (visitId) {
                    this.openCheckinModal(visitId);
                }
            }
        });
        
        // Capture visiteur
        const visitorCaptureBtn = document.getElementById('security-checkin-open-visitor');
        if (visitorCaptureBtn) {
            visitorCaptureBtn.addEventListener('click', () => this.startVisitorCapture());
        }
        
        const visitorStartBtn = document.getElementById('security-checkin-start-visitor');
        if (visitorStartBtn) {
            visitorStartBtn.addEventListener('click', () => this.startVisitorCapture());
        }
        
        // Capture identité
        const identityCaptureBtn = document.getElementById('security-checkin-open-identity');
        if (identityCaptureBtn) {
            identityCaptureBtn.addEventListener('click', () => this.startIdentityCapture());
        }
        
        const identityStartBtn = document.getElementById('security-checkin-start-identity');
        if (identityStartBtn) {
            identityStartBtn.addEventListener('click', () => this.startIdentityCapture());
        }
        
        // Import fichiers
        const fileVisitor = document.getElementById('security-checkin-file-visitor');
        if (fileVisitor) {
            fileVisitor.addEventListener('change', (e) => this.handleFileUpload(e, 'visitor'));
        }
        
        const fileIdentity = document.getElementById('security-checkin-file-identity');
        if (fileIdentity) {
            fileIdentity.addEventListener('change', (e) => this.handleFileUpload(e, 'identity'));
        }
        
        // Boutons remove
        const removeVisitor = document.getElementById('security-checkin-remove-visitor');
        if (removeVisitor) {
            removeVisitor.addEventListener('click', () => this.photoManager.clearVisitorPhoto());
        }
        
        const removeIdentity = document.getElementById('security-checkin-remove-identity');
        if (removeIdentity) {
            removeIdentity.addEventListener('click', () => this.photoManager.clearIdentityPhoto());
        }
        
        // Bouton submit
        const submitBtn = document.getElementById('security-checkin-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitCheckin());
        }
        
        // Nettoyage modal
        const modal = document.getElementById('security-checkin-modal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => {
                this.photoManager.reset();
            });
        }
        
        // Initialiser les boutons inline capture
        this.wireInlineCaptureButtons();
    }
    
    wireInlineCaptureButtons() {
        // Capture button
        const captureVisitorBtn = document.getElementById('captureBtn_inline');
        if (captureVisitorBtn) {
            captureVisitorBtn.onclick = () => this.photoManager.capturePhoto('visitor');
        }
        
        const captureIdentityBtn = document.getElementById('docCapture_inline');
        if (captureIdentityBtn) {
            captureIdentityBtn.onclick = () => this.photoManager.capturePhoto('identity');
        }
        
        // Retake buttons
        const retakeVisitorBtn = document.getElementById('retakeBtn_inline');
        if (retakeVisitorBtn) {
            retakeVisitorBtn.onclick = () => this.photoManager.retakePhoto();
        }
        
        const retakeIdentityBtn = document.getElementById('docRetake_inline');
        if (retakeIdentityBtn) {
            retakeIdentityBtn.onclick = () => this.photoManager.retakePhoto();
        }
        
        // Save buttons
        const saveVisitorBtn = document.getElementById('saveBtn_inline');
        if (saveVisitorBtn) {
            saveVisitorBtn.onclick = () => this.photoManager.savePhoto();
        }
        
        const saveIdentityBtn = document.getElementById('docSave_inline');
        if (saveIdentityBtn) {
            saveIdentityBtn.onclick = () => this.photoManager.savePhoto();
        }
        
        // Cancel buttons
        const cancelVisitorBtn = document.getElementById('cancel_inline');
        if (cancelVisitorBtn) {
            cancelVisitorBtn.onclick = () => this.photoManager.hideCaptureInterface('visitor');
        }
        
        const cancelIdentityBtn = document.getElementById('cancel_id_inline');
        if (cancelIdentityBtn) {
            cancelIdentityBtn.onclick = () => this.photoManager.hideCaptureInterface('identity');
        }
    }
    
    openCheckinModal(visitId) {
        const modal = document.getElementById('security-checkin-modal');
        const visitIdInput = document.getElementById('security-checkin-visit-id');
        
        if (!modal || !visitIdInput) {
            console.warn('Modal elements not found');
            return;
        }
        
        this.photoManager.reset();
        visitIdInput.value = visitId;
        ModalManager.showModal(modal);
    }
    
    startVisitorCapture() {
        if (!SecurityUtils.getCurrentVisitId()) {
            NotificationService.showError('Aucune visite sélectionnée');
            return;
        }
        
        const area = document.getElementById('inline-photo-capture');
        if (area) {
            area.classList.remove('d-none');
            this.photoManager.startCamera('visitor');
        }
    }
    
    startIdentityCapture() {
        if (!SecurityUtils.getCurrentVisitId()) {
            NotificationService.showError('Aucune visite sélectionnée');
            return;
        }
        
        const area = document.getElementById('inline-id-capture');
        if (area) {
            area.classList.remove('d-none');
            this.photoManager.startCamera('identity');
        }
    }
    
    handleFileUpload(event, type) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        if (type === 'visitor') {
            this.photoManager.setVisitorPhoto(file);
        } else {
            this.photoManager.setIdentityPhoto(file);
        }
        
        NotificationService.showSuccess(`Photo ${type === 'visitor' ? 'visiteur' : 'pièce'} importée`);
        event.target.value = ''; // Reset input
    }
    
    async submitCheckin() {
        const visitId = SecurityUtils.getCurrentVisitId();
        await this.checkinService.submitCheckin(visitId);
    }
}

// ==================== INITIALISATION GLOBALE ====================
let photoManager;
let visitsManager;
let checkinService;
let dashboardUI;

function initSecurityDashboard() {
    console.debug('Initializing Security Dashboard...');
    
    if (!SecurityUtils.hasSecurityAccess()) {
        const tbody = document.getElementById('security-visits-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center text-danger py-4">
                        Accès refusé — rôle sécurité requis.
                    </td>
                </tr>
            `;
        }
        return;
    }
    
    // Initialiser les managers
    photoManager = new PhotoManager();
    visitsManager = new VisitsManager();
    checkinService = new CheckinService(photoManager);
    dashboardUI = new SecurityDashboardUI(photoManager, checkinService);
    
    // Stocker globalement pour debugging
    window.photoManager = photoManager;
    window.visitsManager = visitsManager;
    window.checkinService = checkinService;
    
    // Initialiser UI
    dashboardUI.init();
    
    // Charger les visites
    visitsManager.loadVisits();
    visitsManager.startAutoRefresh();
    
    // Écouter les mises à jour de profil
    window.addEventListener('currentUserProfileUpdated', () => {
        if (SecurityUtils.hasSecurityAccess()) {
            visitsManager.loadVisits();
        }
    });
    
    console.debug('Security Dashboard initialized');
}

// Styles additionnels pour les animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .security-toast {
        animation: slideInRight 0.3s ease;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1050;
    }
    
    #security-toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1050;
    }
`;
document.head.appendChild(style);

// Créer le conteneur de toasts s'il n'existe pas
if (!document.getElementById('security-toast-container')) {
    const container = document.createElement('div');
    container.id = 'security-toast-container';
    document.body.appendChild(container);
}

// Démarrer l'application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initSecurityDashboard, 500);
    });
} else {
    setTimeout(initSecurityDashboard, 500);
}

// Export pour debugging (optionnel)
window.debugSecurityDashboard = {
    SecurityUtils,
    PhotoManager,
    VisitsManager,
    CheckinService,
    SecurityDashboardUI,
    initSecurityDashboard,
    config: SECURITY_CONFIG
};