const App = {
    deferredPrompt: null,

    init() {
        this.setupTheme();
        this.setupTabs();
        this.setupSettings();
        this.registerServiceWorker();
        this.setupPWA();
        this.setupOfflineDetection();

        // 各モジュールの初期化
        Calculator.init();
        History.init();
        Materials.init();
        Export.init();
        Goals.init();
        Calendar.init();

        // ダッシュボードの初期化
        if (typeof Dashboard !== 'undefined') {
            Dashboard.init();
        }

        // UserSyncの初期化を追加
        if (typeof UserSync !== 'undefined') {
            UserSync.init();
        } else {
            console.error('UserSync not loaded');
        }

        // アニメーション用CSS追加
        this.addAnimations();
    },

    setupTheme() {
        const savedTheme = Storage.getTheme();
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (savedTheme === 'auto' && prefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        // テーマ切り替えボタン
        document.getElementById('theme-toggle').addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            Storage.setTheme(newTheme);
        });
    },

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // ボタンのアクティブ状態を更新
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // タブコンテンツの表示を更新
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${targetTab}-tab`) {
                        content.classList.add('active');
                    }
                });
                
                // ダッシュボードタブが選択されたら更新
                if (targetTab === 'dashboard' && typeof Dashboard !== 'undefined') {
                    Dashboard.render();
                }

                // 履歴タブが選択されたら更新
                if (targetTab === 'history') {
                    History.renderHistory();
                }
                
                // 目標タブが選択されたら更新
                if (targetTab === 'goals') {
                    Goals.render();
                }
                // カレンダータブが選択されたら更新
                if (targetTab === 'calendar') {
                    Calendar.render();
                }
            });
        });
    },

    setupSettings() {
        const defaultCommissionInput = document.getElementById('default-commission');
        const defaultPlatformSelect = document.getElementById('default-platform');
        const defaultIndirectInput = document.getElementById('default-indirect-costs');
        const defaultProductNameInput = document.getElementById('default-product-name');
        const defaultShippingFeeInput = document.getElementById('default-shipping-fee');
        const settings = Storage.getSettings();

        defaultCommissionInput.value = settings.defaultCommissionRate;
        defaultPlatformSelect.value = settings.defaultPlatform || 'mercari';
        if (defaultIndirectInput) defaultIndirectInput.value = settings.defaultIndirectCosts || 0;
        if (defaultProductNameInput) defaultProductNameInput.value = settings.defaultProductName || '';
        if (defaultShippingFeeInput) defaultShippingFeeInput.value = settings.defaultShippingFee || 0;

        defaultPlatformSelect.addEventListener('change', () => {
            const platform = defaultPlatformSelect.value;
            const platformRates = { mercari: 10, yahoo: 5 };
            const customPlatforms = Storage.getCustomPlatforms();
            const customP = customPlatforms.find(p => p.id === platform);
            const currentSettings = Storage.getSettings();
            const rate = customP ? customP.rate : (platformRates[platform] || currentSettings.defaultCommissionRate);
            const newSettings = {
                ...currentSettings,
                defaultPlatform: platform,
                defaultCommissionRate: rate
            };
            Storage.saveSettings(newSettings);
            defaultCommissionInput.value = newSettings.defaultCommissionRate;
            Calculator.loadDefaults();
        });

        defaultCommissionInput.addEventListener('change', () => {
            const currentSettings = Storage.getSettings();
            const newSettings = {
                ...currentSettings,
                defaultCommissionRate: parseFloat(defaultCommissionInput.value)
            };
            Storage.saveSettings(newSettings);
            Calculator.loadDefaults();
        });

        // デフォルト間接費用
        if (defaultIndirectInput) {
            defaultIndirectInput.addEventListener('change', () => {
                const currentSettings = Storage.getSettings();
                Storage.saveSettings({
                    ...currentSettings,
                    defaultIndirectCosts: parseFloat(defaultIndirectInput.value) || 0
                });
            });
        }

        // デフォルト商品名
        if (defaultProductNameInput) {
            defaultProductNameInput.addEventListener('change', () => {
                const currentSettings = Storage.getSettings();
                Storage.saveSettings({
                    ...currentSettings,
                    defaultProductName: defaultProductNameInput.value
                });
            });
        }

        // デフォルト送料
        if (defaultShippingFeeInput) {
            defaultShippingFeeInput.addEventListener('change', () => {
                const currentSettings = Storage.getSettings();
                Storage.saveSettings({
                    ...currentSettings,
                    defaultShippingFee: parseFloat(defaultShippingFeeInput.value) || 0
                });
            });
        }

        // 送料プリセット管理を初期化
        this.setupShippingSettings();

        // プラットフォーム管理を初期化
        this.setupPlatformSettings();
    },

    // 送料プリセット管理
    selectedShippingPlatform: 'mercari',

    setupShippingSettings() {
        // プラットフォームタブ切り替え
        document.querySelectorAll('.shipping-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.shipping-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedShippingPlatform = btn.dataset.shippingPlatform;
                this.renderShippingPresetList();
            });
        });

        // 追加ボタン
        const addBtn = document.getElementById('add-shipping-preset-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('new-shipping-name');
                const feeInput = document.getElementById('new-shipping-fee');
                const name = nameInput.value.trim();
                const fee = parseFloat(feeInput.value);

                if (!name || isNaN(fee) || fee < 0) {
                    Calculator.showNotification('名前と金額を正しく入力してください', 'error');
                    return;
                }

                const customShipping = Storage.getCustomShipping();
                const platform = this.selectedShippingPlatform;
                if (!customShipping[platform]) customShipping[platform] = [];
                customShipping[platform].push({ name, fee });
                Storage.saveCustomShipping(customShipping);

                nameInput.value = '';
                feeInput.value = '';

                this.renderShippingPresetList();
                Calculator.renderShippingTemplates();
                Calculator.showNotification('送料プリセットを追加しました');
            });
        }

        // カスタムプラットフォーム用のタブも追加
        this.updateShippingPlatformTabs();
        this.renderShippingPresetList();
    },

    updateShippingPlatformTabs() {
        const container = document.getElementById('custom-platform-shipping-tabs');
        if (!container) return;
        const customPlatforms = Storage.getCustomPlatforms();
        container.innerHTML = customPlatforms.map(p =>
            `<button type="button" class="shipping-tab-btn" data-shipping-platform="${p.id}">${p.name}</button>`
        ).join('');

        container.querySelectorAll('.shipping-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.shipping-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedShippingPlatform = btn.dataset.shippingPlatform;
                this.renderShippingPresetList();
            });
        });
    },

    renderShippingPresetList() {
        const container = document.getElementById('shipping-preset-list');
        if (!container) return;

        const platform = this.selectedShippingPlatform;
        const templates = Calculator.getShippingTemplates(platform);

        if (templates.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">プリセットがありません</p>';
            return;
        }

        container.innerHTML = templates.map(t => {
            if (t.isDefault) {
                // デフォルトプリセット: トグルのみ
                return `
                    <div class="preset-item ${t.hidden ? 'hidden-preset' : ''}">
                        <div class="preset-item-info">
                            <span class="preset-item-name">${t.name}</span>
                            <span class="preset-item-value">¥${t.fee.toLocaleString()}</span>
                        </div>
                        <div class="preset-item-actions">
                            <label class="toggle-switch">
                                <input type="checkbox" ${!t.hidden ? 'checked' : ''} data-default-index="${t.index}" data-action="toggle-default">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>`;
            } else {
                // カスタムプリセット: 編集・削除可能
                return `
                    <div class="preset-item custom-preset">
                        <div class="preset-item-info">
                            <span class="preset-item-name">${t.name}</span>
                            <span class="preset-item-value">¥${t.fee.toLocaleString()}</span>
                            <span class="preset-item-badge">カスタム</span>
                        </div>
                        <div class="preset-item-actions">
                            <button class="preset-edit-btn" data-custom-index="${t.index}" data-action="edit-shipping">編集</button>
                            <button class="preset-delete-btn" data-custom-index="${t.index}" data-action="delete-shipping">削除</button>
                        </div>
                    </div>`;
            }
        }).join('');

        // イベント: デフォルトプリセットの表示切替
        container.querySelectorAll('[data-action="toggle-default"]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.defaultIndex);
                const customShipping = Storage.getCustomShipping();
                const hiddenKey = `${platform}_hidden`;
                if (!customShipping[hiddenKey]) customShipping[hiddenKey] = [];

                if (e.target.checked) {
                    customShipping[hiddenKey] = customShipping[hiddenKey].filter(i => i !== idx);
                } else {
                    if (!customShipping[hiddenKey].includes(idx)) {
                        customShipping[hiddenKey].push(idx);
                    }
                }
                Storage.saveCustomShipping(customShipping);
                this.renderShippingPresetList();
                Calculator.renderShippingTemplates();
            });
        });

        // イベント: カスタムプリセット編集
        container.querySelectorAll('[data-action="edit-shipping"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.customIndex);
                const customShipping = Storage.getCustomShipping();
                const items = customShipping[platform] || [];
                const item = items[idx];
                if (!item) return;

                const presetItem = e.target.closest('.preset-item');
                const infoDiv = presetItem.querySelector('.preset-item-info');
                const actionsDiv = presetItem.querySelector('.preset-item-actions');

                infoDiv.innerHTML = `
                    <div class="preset-edit-form">
                        <input type="text" class="edit-name" value="${item.name}">
                        <input type="number" class="edit-fee" value="${item.fee}" min="0">
                        <button class="preset-save-btn">保存</button>
                        <button class="preset-cancel-btn">取消</button>
                    </div>`;
                actionsDiv.style.display = 'none';

                infoDiv.querySelector('.preset-save-btn').addEventListener('click', () => {
                    const newName = infoDiv.querySelector('.edit-name').value.trim();
                    const newFee = parseFloat(infoDiv.querySelector('.edit-fee').value);
                    if (!newName || isNaN(newFee)) return;

                    items[idx] = { name: newName, fee: newFee };
                    customShipping[platform] = items;
                    Storage.saveCustomShipping(customShipping);
                    this.renderShippingPresetList();
                    Calculator.renderShippingTemplates();
                    Calculator.showNotification('更新しました');
                });

                infoDiv.querySelector('.preset-cancel-btn').addEventListener('click', () => {
                    this.renderShippingPresetList();
                });
            });
        });

        // イベント: カスタムプリセット削除
        container.querySelectorAll('[data-action="delete-shipping"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.customIndex);
                if (!confirm('このプリセットを削除しますか？')) return;

                const customShipping = Storage.getCustomShipping();
                const items = customShipping[platform] || [];
                items.splice(idx, 1);
                customShipping[platform] = items;
                Storage.saveCustomShipping(customShipping);
                this.renderShippingPresetList();
                Calculator.renderShippingTemplates();
                Calculator.showNotification('削除しました');
            });
        });
    },

    // プラットフォーム管理
    setupPlatformSettings() {
        const addBtn = document.getElementById('add-platform-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('new-platform-name');
                const rateInput = document.getElementById('new-platform-rate');
                const name = nameInput.value.trim();
                const rate = parseFloat(rateInput.value);

                if (!name || isNaN(rate) || rate < 0 || rate > 100) {
                    Calculator.showNotification('名前と手数料率を正しく入力してください', 'error');
                    return;
                }

                const platforms = Storage.getCustomPlatforms();
                const id = 'custom_' + Date.now().toString();
                platforms.push({ id, name, rate });
                Storage.saveCustomPlatforms(platforms);

                nameInput.value = '';
                rateInput.value = '';

                this.renderCustomPlatformList();
                Calculator.renderPlatformOptions();
                this.updateShippingPlatformTabs();
                Calculator.showNotification(`${name}を追加しました`);
            });
        }

        this.renderCustomPlatformList();
    },

    renderCustomPlatformList() {
        const container = document.getElementById('custom-platform-list');
        if (!container) return;

        const platforms = Storage.getCustomPlatforms();

        if (platforms.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">カスタムプラットフォームはありません</p>';
            return;
        }

        container.innerHTML = platforms.map((p, i) => `
            <div class="preset-item custom-preset">
                <div class="preset-item-info">
                    <span class="preset-item-name">${p.name}</span>
                    <span class="preset-item-value">手数料 ${p.rate}%</span>
                </div>
                <div class="preset-item-actions">
                    <button class="preset-edit-btn" data-platform-index="${i}" data-action="edit-platform">編集</button>
                    <button class="preset-delete-btn" data-platform-index="${i}" data-action="delete-platform">削除</button>
                </div>
            </div>
        `).join('');

        // 編集
        container.querySelectorAll('[data-action="edit-platform"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.platformIndex);
                const platforms = Storage.getCustomPlatforms();
                const p = platforms[idx];
                if (!p) return;

                const presetItem = e.target.closest('.preset-item');
                const infoDiv = presetItem.querySelector('.preset-item-info');
                const actionsDiv = presetItem.querySelector('.preset-item-actions');

                infoDiv.innerHTML = `
                    <div class="preset-edit-form">
                        <input type="text" class="edit-name" value="${p.name}">
                        <input type="number" class="edit-rate" value="${p.rate}" min="0" max="100" step="0.1">
                        <button class="preset-save-btn">保存</button>
                        <button class="preset-cancel-btn">取消</button>
                    </div>`;
                actionsDiv.style.display = 'none';

                infoDiv.querySelector('.preset-save-btn').addEventListener('click', () => {
                    const newName = infoDiv.querySelector('.edit-name').value.trim();
                    const newRate = parseFloat(infoDiv.querySelector('.edit-rate').value);
                    if (!newName || isNaN(newRate)) return;

                    platforms[idx] = { ...platforms[idx], name: newName, rate: newRate };
                    Storage.saveCustomPlatforms(platforms);
                    this.renderCustomPlatformList();
                    Calculator.renderPlatformOptions();
                    this.updateShippingPlatformTabs();
                    Calculator.showNotification('更新しました');
                });

                infoDiv.querySelector('.preset-cancel-btn').addEventListener('click', () => {
                    this.renderCustomPlatformList();
                });
            });
        });

        // 削除
        container.querySelectorAll('[data-action="delete-platform"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.platformIndex);
                if (!confirm('このプラットフォームを削除しますか？')) return;

                const platforms = Storage.getCustomPlatforms();
                const removed = platforms.splice(idx, 1)[0];
                Storage.saveCustomPlatforms(platforms);

                // 関連する送料プリセットも削除
                const customShipping = Storage.getCustomShipping();
                delete customShipping[removed.id];
                delete customShipping[`${removed.id}_hidden`];
                Storage.saveCustomShipping(customShipping);

                this.renderCustomPlatformList();
                Calculator.renderPlatformOptions();
                this.updateShippingPlatformTabs();
                Calculator.showNotification(`${removed.name}を削除しました`);
            });
        });
    },

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    },

    setupPWA() {
        const installButton = document.getElementById('install-pwa');
        
        // インストールプロンプトをキャッチ
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            installButton.style.display = 'block';
            installButton.classList.add('show');
        });
        
        // インストールボタンのクリック
        installButton.addEventListener('click', async () => {
            if (!this.deferredPrompt) return;
            
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`User response: ${outcome}`);
            this.deferredPrompt = null;
            installButton.style.display = 'none';
        });
        
        // インストール完了
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            this.deferredPrompt = null;
        });
    },

    setupOfflineDetection() {
        const banner = document.getElementById('offline-banner');
        if (!banner) return;

        const updateBanner = () => {
            if (!navigator.onLine) {
                banner.classList.add('show');
                document.body.style.paddingTop = banner.offsetHeight + 'px';
            } else {
                banner.classList.remove('show');
                document.body.style.paddingTop = '0';
            }
        };

        window.addEventListener('online', () => {
            updateBanner();
            if (typeof UserSync !== 'undefined') {
                UserSync.processSyncQueue();
            }
        });
        window.addEventListener('offline', updateBanner);

        // 初期状態チェック
        updateBanner();
    },

    addAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
            }
            
            @keyframes slideDown {
                from {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
                to {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', () => {
    // Supabaseの読み込みを待つ
    const checkSupabase = setInterval(() => {
        if (window.supabase) {
            clearInterval(checkSupabase);
            App.init();
        }
    }, 100);
});
