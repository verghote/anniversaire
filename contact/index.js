    "use strict";

    // -----------------------------------------------------------------------------------
    // Import des fonctions nécessaires
    // -----------------------------------------------------------------------------------
    // Aucun import : les bibliothèques externes sont chargées par la page HTML.

    // -----------------------------------------------------------------------------------
    // Déclaration des variables globales
    // -----------------------------------------------------------------------------------
    /**
     * Application de Gestion de Contacts
     * Architecture inspirée des gestionnaires simples type "anniversaire" :
     * - Modèle de données : { id, nomPrenom, telephone, description, createdAt }
     * - Persistance : localStorage
     */

    const STORAGE_KEY = 'verghote_contacts_app_v1';
    const JSON_URL = './contact.json';

    // Palette de couleurs pour les avatars générés automatiquement
    const AVATAR_COLORS = [
        'bg-indigo-100 text-indigo-700 border-indigo-200',
        'bg-emerald-100 text-emerald-700 border-emerald-200',
        'bg-amber-100 text-amber-700 border-amber-200',
        'bg-sky-100 text-sky-700 border-sky-200',
        'bg-purple-100 text-purple-700 border-purple-200',
        'bg-rose-100 text-rose-700 border-rose-200',
        'bg-teal-100 text-teal-700 border-teal-200'
    ];

    // État global de l'application
    let state = {
        contacts: [],
        searchQuery: '',
        sortBy: 'az',
        confirmCallback: null
    };

    // Références DOM principales
    const dom = {
        grid: document.getElementById('contacts-grid'),
        emptyState: document.getElementById('empty-state'),
        emptyTitle: document.getElementById('empty-state-title'),
        emptyDesc: document.getElementById('empty-state-desc'),
        contactCount: document.getElementById('contact-count'),
        searchInput: document.getElementById('search-input'),
        btnClearSearch: document.getElementById('btn-clear-search'),
        sortSelect: document.getElementById('sort-select'),

        // Modale Formulaire
        modal: document.getElementById('contact-modal'),
        modalTitle: document.getElementById('modal-title'),
        form: document.getElementById('contact-form'),
        inputId: document.getElementById('contact-id'),
        inputNomPrenom: document.getElementById('input-contact'),
        inputTelephone: document.getElementById('input-telephone'),
        inputDescription: document.getElementById('input-description'),
        errorNomPrenom: document.getElementById('error-contact'),
        errorTelephone: document.getElementById('error-telephone'),
        btnSubmitLabel: document.getElementById('btn-submit-label'),

        // Modale Confirmation
        confirmModal: document.getElementById('confirm-modal'),
        confirmTitle: document.getElementById('confirm-title'),
        confirmMessage: document.getElementById('confirm-message'),
        btnConfirmOk: document.getElementById('btn-confirm-ok'),
        btnConfirmCancel: document.getElementById('btn-confirm-cancel'),

        // Menu options
        optionsDropdown: document.getElementById('options-dropdown'),
        toastContainer: document.getElementById('toast-container')
    };

// -----------------------------------------------------------------------------------
// Procédures évènementielles
// -----------------------------------------------------------------------------------

    // Relie les commandes de l'interface aux traitements du répertoire.
    function initEventListeners() {
        // Boutons d'ouverture de la modale d'ajout
        document.getElementById('btn-open-add-modal').addEventListener('click', openAddModal);
        document.getElementById('btn-empty-add').addEventListener('click', openAddModal);

        // Fermeture modale formulaire
        document.getElementById('btn-close-modal').addEventListener('click', closeContactModal);
        document.getElementById('btn-cancel-modal').addEventListener('click', closeContactModal);
        document.getElementById('contact-modal-backdrop').addEventListener('click', closeContactModal);

        // Soumission du formulaire
        dom.form.addEventListener('submit', handleFormSubmit);

        // Recherche instantanée
        dom.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderContacts();
        });

        // Bouton effacer recherche
        dom.btnClearSearch.addEventListener('click', () => {
            state.searchQuery = '';
            dom.searchInput.value = '';
            dom.searchInput.focus();
            renderContacts();
        });

        // Tri
        dom.sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            renderContacts();
        });

        // Import / Export JSON
        document.getElementById('btn-export-json').addEventListener('click', exportContactsJSON);
        document.getElementById('btn-export-pdf').addEventListener('click', exportContactsPDF);
        document.getElementById('import-json-input').addEventListener('change', handleImportJSON);

        // Menu déroulant options
        const btnOptions = document.getElementById('btn-options-menu');
        btnOptions.addEventListener('click', (e) => {
            e.stopPropagation();
            dom.optionsDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!dom.optionsDropdown.contains(e.target) && e.target !== btnOptions) {
                dom.optionsDropdown.classList.add('hidden');
            }
        });

        // Action : Vider tout le répertoire
        document.getElementById('btn-clear-all').addEventListener('click', () => {
            dom.optionsDropdown.classList.add('hidden');
            if (state.contacts.length === 0) {
                showToast('La liste est déjà vide.', 'info');
                return;
            }
            openConfirmDialog(
                'Vider tout le répertoire ?',
                'Tous vos contacts enregistrés seront définitivement supprimés.',
                () => {
                    state.contacts = [];
                    saveContacts();
                    renderContacts();
                    showToast('Tous les contacts ont été supprimés.', 'info');
                }
            );
        });

        // Modale de confirmation
        dom.btnConfirmCancel.addEventListener('click', closeConfirmDialog);
        dom.btnConfirmOk.addEventListener('click', () => {
            if (typeof state.confirmCallback === 'function') {
                state.confirmCallback();
            }
            closeConfirmDialog();
        });

        // Touche Échap pour fermer les modales
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!dom.modal.classList.contains('hidden')) closeContactModal();
                if (!dom.confirmModal.classList.contains('hidden')) closeConfirmDialog();
                dom.optionsDropdown.classList.add('hidden');
            }
        });
    }

// -----------------------------------------------------------------------------------
// Fonctions de traitement
// -----------------------------------------------------------------------------------

    // =========================================================================
    // 1. GESTION DU STOCKAGE (LOCALSTORAGE)
    // =========================================================================

    /**
     * Normalise les fichiers actuels et les anciennes sauvegardes sans perdre
     * les identifiants internes utilisés pour modifier et supprimer les contacts.
     */
    function normalizeContacts(data) {
        if (!Array.isArray(data)) {
            throw new Error('Un tableau de contacts est attendu.');
        }
        return data.map((item, index) => {
            const name = item && (typeof item.contact === 'string' ? item.contact : item.nomPrenom);
            if (typeof name !== 'string' || !name.trim() ||
                typeof item.telephone !== 'string' || !item.telephone.trim() ||
                (item.description != null && typeof item.description !== 'string')) {
                throw new Error(`Contact invalide à la position ${index + 1}.`);
            }
            return {
                id: typeof item.id === 'string' && item.id ? item.id :
                    `contact-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
                nomPrenom: name.trim(),
                telephone: formatPhoneNumber(item.telephone),
                description: typeof item.description === 'string' ? item.description.trim() : '',
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
            };
        });
    }

    /**
     * Privilégie la sauvegarde locale, y compris une liste volontairement vide.
     * Sans sauvegarde, charge le fichier initial puis le mémorise localement.
     */
    async function loadContacts() {
        try {
            const rawData = localStorage.getItem(STORAGE_KEY);
            if (rawData !== null) {
                state.contacts = normalizeContacts(JSON.parse(rawData));
                return;
            }
            if (/^https?:$/.test(window.location.protocol)) {
                const response = await fetch(JSON_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error(`Chargement de contact.json : HTTP ${response.status}`);
                state.contacts = normalizeContacts(await response.json());
                saveContacts();
            } else {
                showToast('Le chargement de contact.json nécessite un serveur HTTP.', 'info');
            }
        } catch (error) {
            console.error('Impossible de charger les contacts :', error);
            showToast('Impossible de charger les contacts locaux ou contact.json.', 'error');
        }
    }

    /**
     * Sauvegarde la liste actuelle dans le localStorage
     */
    function saveContacts() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde :', error);
            showToast('Impossible de sauvegarder dans le navigateur.', 'error');
        }
    }

    // =========================================================================
    // 2. UTILITAIRES (FORMATAGE, INITIALES, SÉCURITÉ XSS, TOAST)
    // =========================================================================

    /**
     * Échappe les caractères HTML pour éviter toute injection XSS
     */
    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Génère les initiales (2 lettres max) à partir de nomPrénom
     */
    function getInitials(nomPrenom) {
        const parts = nomPrenom.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Attribue une couleur d'avatar déterministe selon le nom du contact
     */
    function getAvatarColorClass(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % AVATAR_COLORS.length;
        return AVATAR_COLORS[index];
    }

    /**
     * Formate proprement un numéro français à 10 chiffres (ex: 0612345678 -> 06 12 34 56 78)
     * tout en conservant les formats internationaux (+33...) intacts.
     */
    function formatPhoneNumber(phone) {
        const cleaned = phone.trim();
        const digitsOnly = cleaned.replace(/[\s.-]/g, '');
        if (/^0[1-9]\d{8}$/.test(digitsOnly)) {
            return digitsOnly.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
        }
        return cleaned;
    }

    /**
     * Nettoie un numéro pour le lien href="tel:..."
     */
    function getTelHref(phone) {
        return 'tel:' + phone.replace(/[^\d+]/g, '');
    }

    /**
     * Copie un texte dans le presse-papiers avec fallback compatible iFrame
     */
    function copyToClipboard(text, label = 'Numéro copié') {
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = text;
            tempInput.style.position = 'fixed';
            tempInput.style.opacity = '0';
            document.body.appendChild(tempInput);
            tempInput.select();
            const success = document.execCommand('copy');
            document.body.removeChild(tempInput);

            if (success) {
                showToast(`${label} : ${text}`, 'success');
            } else {
                throw new Error('Échec execCommand');
            }
        } catch (err) {
            showToast('Impossible de copier le numéro.', 'error');
        }
    }

    /**
     * Affiche une notification visuelle temporaire (Toast)
     */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');

        const styles = {
            success: 'bg-slate-900 text-white border-slate-800',
            error: 'bg-rose-600 text-white border-rose-700',
            info: 'bg-indigo-600 text-white border-indigo-700'
        };

        const icons = {
            success: 'check-circle-2',
            error: 'alert-circle',
            info: 'info'
        };

        toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-toast ${styles[type] || styles.info}`;
        toast.innerHTML = `
                <i data-lucide="${icons[type] || icons.info}" class="w-4 h-4 shrink-0"></i>
                <span class="flex-1">${escapeHTML(message)}</span>
            `;

        dom.toastContainer.appendChild(toast);
        if (window.lucide) lucide.createIcons({ root: toast });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(0.5rem)';
            toast.style.transition = 'all 0.2s ease';
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    }

    // =========================================================================
    // 3. FILTRAGE, TRI ET RENDU DE L'INTERFACE
    // =========================================================================

    /**
     * Retourne la liste filtrée et triée selon l'état actuel
     */
    function getFilteredAndSortedContacts() {
        const query = state.searchQuery.toLowerCase().trim();

        // 1. Filtrage instantané sur nomPrénom, téléphone et description
        let result = state.contacts.filter(contact => {
            if (!query) return true;
            const matchName = contact.nomPrenom.toLowerCase().includes(query);
            const matchPhone = contact.telephone.toLowerCase().includes(query) ||
                contact.telephone.replace(/\s+/g, '').includes(query.replace(/\s+/g, ''));
            const matchDesc = (contact.description || '').toLowerCase().includes(query);
            return matchName || matchPhone || matchDesc;
        });

        // 2. Tri
        result.sort((a, b) => {
            if (state.sortBy === 'az') {
                return a.nomPrenom.localeCompare(b.nomPrenom, 'fr', { sensitivity: 'base' });
            } else if (state.sortBy === 'za') {
                return b.nomPrenom.localeCompare(a.nomPrenom, 'fr', { sensitivity: 'base' });
            } else if (state.sortBy === 'recent') {
                return (b.createdAt || 0) - (a.createdAt || 0);
            }
            return 0;
        });

        return result;
    }

    /**
     * Met à jour l'affichage complet de la grille des contacts
     */
    function renderContacts() {
        const filteredContacts = getFilteredAndSortedContacts();
        const total = filteredContacts.length;

        // Mise à jour du compteur
        dom.contactCount.textContent = `${total} ${total > 1 ? 'contacts' : 'contact'}`;

        // Gestion de l'affichage du bouton d'effacement de recherche
        if (state.searchQuery.trim().length > 0) {
            dom.btnClearSearch.classList.remove('hidden');
        } else {
            dom.btnClearSearch.classList.add('hidden');
        }

        // Cas où aucun contact n'est affiché
        if (total === 0) {
            dom.grid.innerHTML = '';
            dom.grid.classList.add('hidden');
            dom.emptyState.classList.remove('hidden');

            if (state.contacts.length > 0 && state.searchQuery.trim() !== '') {
                dom.emptyTitle.textContent = 'Aucun résultat trouvé';
                dom.emptyDesc.textContent = `Aucun contact ne correspond à votre recherche « ${state.searchQuery} ».`;
            } else {
                dom.emptyTitle.textContent = 'Aucun contact enregistré';
                dom.emptyDesc.textContent = 'Votre répertoire est actuellement vide. Ajoutez votre premier contact.';
            }
            return;
        }

        // Affichage de la grille
        dom.emptyState.classList.add('hidden');
        dom.grid.classList.remove('hidden');

        dom.grid.innerHTML = filteredContacts.map(contact => {
            const initials = getInitials(contact.nomPrenom);
            const avatarClass = getAvatarColorClass(contact.nomPrenom);
            const telHref = getTelHref(contact.telephone);
            const hasDescription = contact.description && contact.description.trim().length > 0;

            return `
                    <article class="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between card-hover shadow-2xs" data-id="${escapeHTML(contact.id)}">
                        <div>
                            <!-- En-tête de la carte : Avatar + Nom + Actions rapides -->
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-center gap-3.5 min-w-0">
                                    <div class="w-12 h-12 rounded-xl border font-bold text-base flex items-center justify-center shrink-0 select-none ${avatarClass}">
                                        ${escapeHTML(initials)}
                                    </div>
                                    <div class="min-w-0">
                                        <h3 class="text-base font-bold text-slate-900 truncate" title="${escapeHTML(contact.nomPrenom)}">
                                            ${escapeHTML(contact.nomPrenom)}
                                        </h3>
                                        <!-- Numéro cliquable (tel:) -->
                                        <a href="${escapeHTML(telHref)}" class="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-0.5 group">
                                            <i data-lucide="phone" class="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform"></i>
                                            <span>${escapeHTML(contact.telephone)}</span>
                                        </a>
                                    </div>
                                </div>

                                <!-- Boutons Modifier / Supprimer -->
                                <div class="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onclick="openEditModal('${escapeHTML(contact.id)}')"
                                        class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Modifier ce contact"
                                    >
                                        <i data-lucide="pencil" class="w-4 h-4"></i>
                                    </button>
                                    <button
                                        type="button"
                                        onclick="requestDeleteContact('${escapeHTML(contact.id)}')"
                                        class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Supprimer ce contact"
                                    >
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Zone Description -->
                            <div class="mt-4 pt-3.5 border-t border-slate-100">
                                ${hasDescription
                ? `<p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">${escapeHTML(contact.description)}</p>`
                : `<p class="text-xs italic text-slate-400">Aucune description renseignée.</p>`
            }
                            </div>
                        </div>

                        <!-- Barre d'actions en bas de carte -->
                        <div class="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                            <a
                                href="${escapeHTML(telHref)}"
                                class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                            >
                                <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
                                <span>Appeler</span>
                            </a>
                            <button
                                type="button"
                                onclick="copyToClipboard('${escapeHTML(contact.telephone).replace(/'/g, "\\'")}', 'Numéro copié')"
                                class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
                            >
                                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                                <span>Copier n°</span>
                            </button>
                        </div>
                    </article>
                `;
        }).join('');

        // Réinitialisation des icônes Lucide fraîchement injectées
        if (window.lucide) lucide.createIcons({ root: dom.grid });
    }

    // =========================================================================
    // 4. OPÉRATIONS CRUD (AJOUT, ÉDITION, SUPPRESSION)
    // =========================================================================

    /**
     * Ouvre la modale en mode Création
     */
    function openAddModal() {
        dom.form.reset();
        dom.inputId.value = '';
        dom.modalTitle.textContent = 'Nouveau contact';
        dom.btnSubmitLabel.textContent = 'Ajouter';
        clearFormErrors();

        dom.modal.classList.remove('hidden');
        setTimeout(() => dom.inputNomPrenom.focus(), 50);
    }

    /**
     * Ouvre la modale en mode Modification avec les données pré-remplies
     */
    window.openEditModal = function(id) {
        const contact = state.contacts.find(c => c.id === id);
        if (!contact) return;

        dom.inputId.value = contact.id;
        dom.inputNomPrenom.value = contact.nomPrenom;
        dom.inputTelephone.value = contact.telephone;
        dom.inputDescription.value = contact.description || '';

        dom.modalTitle.textContent = 'Modifier le contact';
        dom.btnSubmitLabel.textContent = 'Enregistrer';
        clearFormErrors();

        dom.modal.classList.remove('hidden');
        setTimeout(() => dom.inputNomPrenom.focus(), 50);
    };

    /**
     * Ferme la modale d'ajout/édition
     */
    function closeContactModal() {
        dom.modal.classList.add('hidden');
        clearFormErrors();
    }

    /**
     * Réinitialise les messages d'erreur du formulaire
     */
    function clearFormErrors() {
        dom.errorNomPrenom.classList.add('hidden');
        dom.errorTelephone.classList.add('hidden');
        dom.inputNomPrenom.classList.remove('border-rose-500');
        dom.inputTelephone.classList.remove('border-rose-500');
    }

    /**
     * Valide et soumet le formulaire d'ajout ou de modification
     */
    function handleFormSubmit(e) {
        e.preventDefault();
        clearFormErrors();

        const id = dom.inputId.value.trim();
        const nomPrenom = dom.inputNomPrenom.value.trim();
        const rawTelephone = dom.inputTelephone.value.trim();
        const description = dom.inputDescription.value.trim();

        let isValid = true;

        // Validation nomPrénom obligatoire
        if (!nomPrenom) {
            dom.errorNomPrenom.classList.remove('hidden');
            dom.inputNomPrenom.classList.add('border-rose-500');
            isValid = false;
        }

        // Validation téléphone obligatoire (au moins 4 chiffres)
        const digitCount = (rawTelephone.match(/\d/g) || []).length;
        if (!rawTelephone || digitCount < 4) {
            dom.errorTelephone.classList.remove('hidden');
            dom.inputTelephone.classList.add('border-rose-500');
            isValid = false;
        }

        if (!isValid) return;

        const formattedPhone = formatPhoneNumber(rawTelephone);

        if (id) {
            // Mise à jour d'un contact existant
            const index = state.contacts.findIndex(c => c.id === id);
            if (index !== -1) {
                state.contacts[index] = {
                    ...state.contacts[index],
                    nomPrenom,
                    telephone: formattedPhone,
                    description
                };
                showToast('Contact mis à jour avec succès.', 'success');
            }
        } else {
            // Création d'un nouveau contact
            const newContact = {
                id: 'contact-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
                nomPrenom,
                telephone: formattedPhone,
                description,
                createdAt: Date.now()
            };
            state.contacts.push(newContact);
            showToast('Contact ajouté au répertoire.', 'success');
        }

        saveContacts();
        renderContacts();
        closeContactModal();
    }

    /**
     * Demande confirmation avant de supprimer un contact
     */
    window.requestDeleteContact = function(id) {
        const contact = state.contacts.find(c => c.id === id);
        if (!contact) return;

        openConfirmDialog(
            'Supprimer ce contact ?',
            `Voulez-vous vraiment supprimer « ${contact.nomPrenom} » de votre répertoire ?`,
            () => {
                state.contacts = state.contacts.filter(c => c.id !== id);
                saveContacts();
                renderContacts();
                showToast('Contact supprimé.', 'info');
            }
        );
    };

    // =========================================================================
    // 5. MODALE DE CONFIRMATION PERSONNALISÉE
    // =========================================================================

    // Affiche une confirmation avant une opération destructive.
    function openConfirmDialog(title, message, onConfirm) {
        dom.confirmTitle.textContent = title;
        dom.confirmMessage.textContent = message;
        state.confirmCallback = onConfirm;
        dom.confirmModal.classList.remove('hidden');
    }

    // Ferme la confirmation et oublie l'action en attente.
    function closeConfirmDialog() {
        dom.confirmModal.classList.add('hidden');
        state.confirmCallback = null;
    }

    // =========================================================================
    // 6. IMPORT / EXPORT JSON & OPTIONS DE DONNÉES
    // =========================================================================

    /**
     * Exporte les contacts au format JSON téléchargeable
     */
    function exportContactsJSON() {
        if (state.contacts.length === 0) {
            showToast('Aucun contact à exporter.', 'error');
            return;
        }

        // Le fichier échangeable ne contient pas les métadonnées internes du navigateur.
        const exportedContacts = state.contacts.map(({ nomPrenom, telephone, description }) => ({
            contact: nomPrenom,
            telephone,
            description: description || ''
        }));
        const dataStr = JSON.stringify(exportedContacts, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const dateStr = new Date().toISOString().slice(0, 10);
        const link = document.createElement('a');
        link.href = url;
        link.download = `contacts-sauvegarde-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`${state.contacts.length} contact(s) exporté(s) en JSON.`, 'success');
    }

    // Exporte tous les contacts ; l'impression prend le relais sans jsPDF.
    function exportContactsPDF() {
        if (state.contacts.length === 0) {
            showToast('Aucun contact à exporter.', 'error');
            return;
        }

        const contacts = [...state.contacts].sort((a, b) =>
            a.nomPrenom.localeCompare(b.nomPrenom, 'fr', { sensitivity: 'base' })
        );
        const rows = contacts.map(contact => [
            contact.nomPrenom, contact.telephone, contact.description || ''
        ]);
        if (window.jspdf && window.jspdf.jsPDF) {
            const doc = new window.jspdf.jsPDF();
            if (typeof doc.autoTable === 'function') {
                doc.text('Répertoire des contacts', 14, 18);
                doc.autoTable({
                    startY: 24,
                    head: [['Nom et prénom', 'Téléphone', 'Description']],
                    body: rows,
                    styles: { overflow: 'linebreak', fontSize: 9 },
                    headStyles: { fillColor: [79, 70, 229] },
                    didDrawPage: ({ pageNumber }) => {
                        doc.setFontSize(8);
                        doc.text(`Page ${pageNumber}`, 196, 287, { align: 'right' });
                    }
                });
                doc.save('repertoire-contacts.pdf');
                return;
            }
        }

        const container = document.getElementById('print-contacts');
        container.replaceChildren();
        const title = document.createElement('h1');
        title.textContent = 'Répertoire des contacts';
        const table = document.createElement('table');
        const head = table.createTHead().insertRow();
        ['Nom et prénom', 'Téléphone', 'Description'].forEach(label => {
            const cell = document.createElement('th');
            cell.textContent = label;
            head.appendChild(cell);
        });
        const body = table.createTBody();
        rows.forEach(row => {
            const tr = body.insertRow();
            row.forEach(value => { tr.insertCell().textContent = value; });
        });
        container.append(title, table);
        showToast('Bibliothèque PDF indisponible : choisissez « Enregistrer en PDF » dans la fenêtre d’impression.', 'info');
        window.print();
    }

    /**
     * Importe un fichier JSON et fusionne ou remplace les contacts
     */
    function handleImportJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                // Les anciens exports avec nomPrenom restent importables.
                const validContacts = normalizeContacts(imported);

                if (validContacts.length === 0) {
                    showToast('Aucun contact valide trouvé dans ce fichier.', 'error');
                    return;
                }

                // Ajout sans doublon d'ID
                const existingIds = new Set(state.contacts.map(c => c.id));
                let addedCount = 0;

                validContacts.forEach(c => {
                    while (existingIds.has(c.id)) {
                        c.id = `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                    }
                    existingIds.add(c.id);
                    state.contacts.push(c);
                    addedCount++;
                });

                saveContacts();
                renderContacts();
                showToast(`${addedCount} contact(s) importé(s) avec succès.`, 'success');
            } catch (err) {
                console.error(err);
                showToast('Erreur lors de la lecture du fichier JSON.', 'error');
            } finally {
                event.target.value = ''; // Réinitialise l'input file
            }
        };
        reader.onerror = () => {
            console.error('Impossible de lire le fichier JSON :', reader.error);
            showToast('Erreur lors de la lecture du fichier JSON.', 'error');
            event.target.value = '';
        };
        reader.readAsText(file);
    }

// -----------------------------------------------------------------------------------
// Programme principal
// -----------------------------------------------------------------------------------
    // Lancement de l'application au chargement du DOM
    document.addEventListener('DOMContentLoaded', async () => {
        if (window.lucide) lucide.createIcons();
        if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
            navigator.serviceWorker.register('../sw.js').catch(error => {
                console.error("Impossible d'activer le mode hors connexion :", error);
            });
        }
        await loadContacts();
        initEventListeners();
        renderContacts();
    });
