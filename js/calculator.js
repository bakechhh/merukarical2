// calculator.js - 計算機能（編集機能付き）
const Calculator = {
    editingId: null, // 編集中のID

    shippingTemplates: {
        mercari: [
            { name: 'ネコポス', fee: 210 },
            { name: 'ゆうパケット', fee: 230 },
            { name: 'ゆうパケットポスト', fee: 215 },
            { name: '宅急便コンパクト', fee: 450 },
            { name: '60サイズ', fee: 750 },
            { name: '80サイズ', fee: 850 },
            { name: '100サイズ', fee: 1050 }
        ],
        yahoo: [
            { name: 'ネコポス', fee: 170 },
            { name: 'ゆうパケット', fee: 205 },
            { name: 'ゆうパケットポスト', fee: 175 },
            { name: '宅急便コンパクト', fee: 380 },
            { name: '60サイズ', fee: 700 },
            { name: '80サイズ', fee: 800 },
            { name: '100サイズ', fee: 1000 }
        ]
    },

    init() {
        this.form = document.getElementById('calc-form');
        this.renderPlatformOptions();
        this.setupEventListeners();
        this.loadDefaults();
        this.addMaterialRow(); // 初期材料行
        this.updateMaterialSelects();
        this.setDefaultDate(); // 初期日付設定
        this.renderShippingTemplates();
    },

    setupEventListeners() {
        // フォーム送信
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingId) {
                this.updateSale();
            } else {
                this.saveSale();
            }
        });

        // リアルタイム計算
        ['selling-price', 'shipping-fee', 'indirect-costs', 'commission-rate'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculate());
        });

        // プラットフォーム変更
        document.getElementById('platform').addEventListener('change', (e) => {
            this.onPlatformChange(e.target.value);
        });

        // 材料追加ボタン
        document.getElementById('add-material-btn').addEventListener('click', () => {
            this.addMaterialRow();
        });

        // 材料入力の変更監視（イベント委譲）
        document.getElementById('material-inputs').addEventListener('input', (e) => {
            if (e.target.classList.contains('material-select') || 
                e.target.classList.contains('material-quantity') ||
                e.target.classList.contains('material-price')) {
                this.handleMaterialChange(e.target);
                this.calculate();
            }
        });

        // 材料削除ボタン（イベント委譲）
        document.getElementById('material-inputs').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-material-btn')) {
                this.removeMaterialRow(e.target);
            }
        });

        // 逆算シミュレーション トグル
        const reverseToggle = document.getElementById('reverse-calc-toggle');
        if (reverseToggle) {
            reverseToggle.addEventListener('click', () => {
                const panel = document.getElementById('reverse-calc-panel');
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    reverseToggle.textContent = '逆算シミュレーション ▲';
                } else {
                    panel.style.display = 'none';
                    reverseToggle.textContent = '逆算シミュレーション ▼';
                }
            });
        }

        // 逆算入力イベント
        const targetInput = document.getElementById('target-income');
        if (targetInput) {
            targetInput.addEventListener('input', () => this.calculateReverse());
        }
    },

    setDefaultDate() {
        const dateInput = document.getElementById('sale-date');
        if (dateInput && !this.editingId) {
            // 現在の日付を設定
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            
            dateInput.value = `${year}-${month}-${day}`;
        }
    },

    loadDefaults() {
        const settings = Storage.getSettings();
        const platformSelect = document.getElementById('platform');
        const commissionInput = document.getElementById('commission-rate');

        // デフォルトプラットフォームを設定
        const defaultPlatform = settings.defaultPlatform || 'mercari';
        if (platformSelect.querySelector(`option[value="${defaultPlatform}"]`)) {
            platformSelect.value = defaultPlatform;
        }
        this.onPlatformChange(platformSelect.value);

        // デフォルト間接費用
        if (settings.defaultIndirectCosts) {
            const indirectInput = document.getElementById('indirect-costs');
            if (indirectInput && !this.editingId) {
                indirectInput.value = settings.defaultIndirectCosts;
            }
        }

        // デフォルト商品名プレフィックス
        if (settings.defaultProductName) {
            const nameInput = document.getElementById('product-name');
            if (nameInput && !nameInput.value && !this.editingId) {
                nameInput.value = settings.defaultProductName;
            }
        }

        // デフォルト送料
        if (settings.defaultShippingFee) {
            const shippingInput = document.getElementById('shipping-fee');
            if (shippingInput && !this.editingId) {
                shippingInput.value = settings.defaultShippingFee;
            }
        }
    },

    renderPlatformOptions() {
        const platformSelect = document.getElementById('platform');
        const defaultPlatformSelect = document.getElementById('default-platform');
        const customPlatforms = Storage.getCustomPlatforms();

        const builtInOptions = [
            { value: 'mercari', label: 'メルカリ（手数料10%）', rate: 10 },
            { value: 'yahoo', label: 'Yahoo!フリマ（手数料5%）', rate: 5 }
        ];

        const allOptions = [
            ...builtInOptions,
            ...customPlatforms.map(p => ({
                value: p.id,
                label: `${p.name}（手数料${p.rate}%）`,
                rate: p.rate
            })),
            { value: 'custom', label: 'カスタム', rate: '' }
        ];

        const currentValue = platformSelect.value;

        platformSelect.innerHTML = allOptions.map(o =>
            `<option value="${o.value}" data-rate="${o.rate}">${o.label}</option>`
        ).join('');

        // 現在の値を復元
        if (currentValue && platformSelect.querySelector(`option[value="${currentValue}"]`)) {
            platformSelect.value = currentValue;
        }

        // 設定画面のデフォルトプラットフォームセレクトも更新
        if (defaultPlatformSelect) {
            const defaultCurrent = defaultPlatformSelect.value;
            defaultPlatformSelect.innerHTML = allOptions.filter(o => o.value !== 'custom').map(o =>
                `<option value="${o.value}">${o.label}</option>`
            ).join('');
            if (defaultCurrent && defaultPlatformSelect.querySelector(`option[value="${defaultCurrent}"]`)) {
                defaultPlatformSelect.value = defaultCurrent;
            }
        }
    },

    onPlatformChange(platform) {
        const commissionInput = document.getElementById('commission-rate');
        const platformRates = { mercari: 10, yahoo: 5 };

        // カスタムプラットフォームの手数料率も対応
        const customPlatforms = Storage.getCustomPlatforms();
        const customPlatform = customPlatforms.find(p => p.id === platform);

        if (platform === 'custom') {
            commissionInput.readOnly = false;
            commissionInput.value = '';
            commissionInput.focus();
        } else if (customPlatform) {
            commissionInput.readOnly = false;
            commissionInput.value = customPlatform.rate;
        } else {
            commissionInput.readOnly = false;
            commissionInput.value = platformRates[platform] || 10;
        }
        this.renderShippingTemplates();
        this.calculate();
    },

    getShippingTemplates(platform) {
        // デフォルトテンプレートを取得
        const defaults = this.shippingTemplates[platform] || [];
        const customShipping = Storage.getCustomShipping();
        const customForPlatform = customShipping[platform] || [];

        // hidden情報を取得（デフォルトプリセットの非表示設定）
        const hiddenDefaults = customShipping[`${platform}_hidden`] || [];

        // デフォルトテンプレートにhiddenフラグを付与
        const defaultTemplates = defaults.map((t, i) => ({
            ...t,
            isDefault: true,
            hidden: hiddenDefaults.includes(i),
            index: i
        }));

        // カスタムテンプレート
        const customTemplates = customForPlatform.map((t, i) => ({
            ...t,
            isDefault: false,
            isCustom: true,
            index: i
        }));

        return [...defaultTemplates, ...customTemplates];
    },

    renderShippingTemplates() {
        const container = document.getElementById('shipping-templates');
        if (!container) return;

        const platform = document.getElementById('platform').value;
        const templates = this.getShippingTemplates(platform);

        // 非表示でないテンプレートのみ表示
        const visibleTemplates = templates.filter(t => !t.hidden);

        if (visibleTemplates.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = visibleTemplates.map(t =>
            `<button type="button" class="shipping-template-btn${t.isCustom ? ' custom-template' : ''}" data-fee="${t.fee}">${t.name} ¥${t.fee.toLocaleString()}</button>`
        ).join('');

        container.querySelectorAll('.shipping-template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('shipping-fee').value = btn.dataset.fee;
                // active状態の管理
                container.querySelectorAll('.shipping-template-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.calculate();
            });
        });

        // 送料手動入力時にactiveクリア
        const shippingInput = document.getElementById('shipping-fee');
        shippingInput.addEventListener('input', () => {
            container.querySelectorAll('.shipping-template-btn').forEach(b => b.classList.remove('active'));
        });
    },

    addMaterialRow() {
        const container = document.getElementById('material-inputs');
        const row = document.createElement('div');
        row.className = 'material-input-row';
        
        row.innerHTML = `
            <div class="material-select-wrapper">
                <input type="text" 
                       class="material-search" 
                       placeholder="材料を検索..."
                       autocomplete="off">
                <select class="material-select" style="display: none;">
                    <option value="">材料を選択</option>
                    <option value="custom">直接入力</option>
                </select>
                <div class="material-dropdown" style="display: none;"></div>
            </div>
            <input type="number" class="material-quantity" placeholder="数量" min="0" step="0.01">
            <input type="number" class="material-price" placeholder="単価" min="0" step="0.01">
            <button type="button" class="remove-material-btn">×</button>
        `;
        
        container.appendChild(row);
        this.setupMaterialSearch(row);
        this.updateMaterialSelects();
    },

    setupMaterialSearch(row) {
        const searchInput = row.querySelector('.material-search');
        const dropdown = row.querySelector('.material-dropdown');
        const select = row.querySelector('.material-select');
        
        // 検索入力時
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.showMaterialDropdown(row, query);
        });
        
        // フォーカス時
        searchInput.addEventListener('focus', () => {
            this.showMaterialDropdown(row, '');
        });
        
        // フォーカスアウト時
        searchInput.addEventListener('blur', (e) => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        });
    },

    showMaterialDropdown(row, query) {
        const dropdown = row.querySelector('.material-dropdown');
        const materials = Storage.getMaterials();
        const favorites = Storage.getFavoriteMaterials();
        
        // カテゴリー別にグループ化
        const grouped = materials.reduce((acc, m) => {
            const category = m.category || 'その他';
            if (!acc[category]) acc[category] = [];
            acc[category].push(m);
            return acc;
        }, {});
        
        // お気に入り材料を抽出
        const favoriteMaterials = materials.filter(m => favorites.includes(m.id));
        
        // 検索フィルタリング
        const filteredGroups = {};
        const filteredFavorites = [];
        
        // お気に入りをフィルタリング
        if (favoriteMaterials.length > 0) {
            const filtered = favoriteMaterials.filter(m => 
                m.name.toLowerCase().includes(query) ||
                (m.category || '').toLowerCase().includes(query)
            );
            if (filtered.length > 0) {
                filteredFavorites.push(...filtered);
            }
        }
        
        // 通常の材料をフィルタリング
        Object.entries(grouped).forEach(([category, items]) => {
            const filtered = items.filter(m => 
                m.name.toLowerCase().includes(query) ||
                category.toLowerCase().includes(query)
            );
            if (filtered.length > 0) {
                filteredGroups[category] = filtered;
            }
        });
        
        // カテゴリーの折りたたみ状態を取得
        const collapsedCategories = this.getCollapsedCategories();
        
        // ドロップダウンHTML生成
        dropdown.innerHTML = `
            <div class="dropdown-item" data-value="custom">
                <strong>直接入力</strong>
            </div>
            ${filteredFavorites.length > 0 ? `
                <div class="dropdown-category">
                    <span class="category-icon">⭐</span>
                    お気に入り
                </div>
                ${filteredFavorites.map(m => `
                    <div class="dropdown-item favorite-item" 
                         data-value="${m.id}"
                         data-price="${m.unitPrice}"
                         data-unit="${m.unit}"
                         data-category="${m.category}"
                         data-name="${m.name}">
                        <div class="dropdown-item-main">
                            <span class="favorite-star">⭐</span>
                            <span>${m.name}</span>
                        </div>
                        <div class="dropdown-item-detail">¥${m.unitPrice}/${m.unit}</div>
                    </div>
                `).join('')}
            ` : ''}
            ${Object.entries(filteredGroups).map(([category, items]) => `
                <div class="dropdown-category ${collapsedCategories.includes(category) ? 'collapsed' : ''}" 
                     data-category="${category}"
                     onclick="Calculator.toggleCategory('${category}')">
                    <span class="category-toggle">${collapsedCategories.includes(category) ? '▶' : '▼'}</span>
                    ${category}
                    <span class="category-count">(${items.length})</span>
                </div>
                <div class="category-items ${collapsedCategories.includes(category) ? 'hidden' : ''}">
                    ${items.map(m => `
                        <div class="dropdown-item" 
                             data-value="${m.id}"
                             data-price="${m.unitPrice}"
                             data-unit="${m.unit}"
                             data-category="${m.category}"
                             data-name="${m.name}">
                            <div class="dropdown-item-main">
                                <span>${m.name}</span>
                                <button class="favorite-btn ${favorites.includes(m.id) ? 'active' : ''}" 
                                        onclick="event.stopPropagation(); Calculator.toggleFavorite('${m.id}', this)">
                                    ${favorites.includes(m.id) ? '★' : '☆'}
                                </button>
                            </div>
                            <div class="dropdown-item-detail">¥${m.unitPrice}/${m.unit}</div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
        
        // アイテムクリック時の処理
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            if (!item.classList.contains('dropdown-category')) {
                item.addEventListener('click', () => {
                    this.selectMaterial(row, item);
                });
            }
        });
        
        dropdown.style.display = 'block';
    },

    toggleCategory(category) {
        const collapsed = this.getCollapsedCategories();
        const index = collapsed.indexOf(category);
        
        if (index > -1) {
            collapsed.splice(index, 1);
        } else {
            collapsed.push(category);
        }
        
        localStorage.setItem('collapsed_categories', JSON.stringify(collapsed));
        
        // UIを更新
        document.querySelectorAll('.material-dropdown').forEach(dropdown => {
            if (dropdown.style.display !== 'none') {
                const searchInput = dropdown.parentElement.querySelector('.material-search');
                const query = searchInput ? searchInput.value.toLowerCase() : '';
                this.showMaterialDropdown(dropdown.parentElement.parentElement, query);
            }
        });
    },

    getCollapsedCategories() {
        const stored = localStorage.getItem('collapsed_categories');
        return stored ? JSON.parse(stored) : [];
    },

    toggleFavorite(materialId, button) {
        const favorites = Storage.getFavoriteMaterials();
        const index = favorites.indexOf(materialId);
        
        if (index > -1) {
            favorites.splice(index, 1);
            button.classList.remove('active');
            button.textContent = '☆';
        } else {
            favorites.push(materialId);
            button.classList.add('active');
            button.textContent = '★';
        }
        
        Storage.saveFavoriteMaterials(favorites);
        
        // 他のドロップダウンも更新
        document.querySelectorAll('.material-dropdown').forEach(dropdown => {
            if (dropdown.style.display !== 'none') {
                const searchInput = dropdown.parentElement.querySelector('.material-search');
                const query = searchInput ? searchInput.value.toLowerCase() : '';
                this.showMaterialDropdown(dropdown.parentElement.parentElement, query);
            }
        });
    },

    selectMaterial(row, item) {
        const searchInput = row.querySelector('.material-search');
        const select = row.querySelector('.material-select');
        const priceInput = row.querySelector('.material-price');
        const dropdown = row.querySelector('.material-dropdown');
        
        const value = item.dataset.value;
        select.value = value;
        
        if (value === 'custom') {
            searchInput.value = '直接入力';
            this.showCustomMaterialInput(row);
            priceInput.value = '';
        } else {
            searchInput.value = item.dataset.name;
            this.hideCustomMaterialInput(row);
            priceInput.value = item.dataset.price;
        }
        
        dropdown.style.display = 'none';
        this.calculate();
    },

    removeMaterialRow(button) {
        const row = button.closest('.material-input-row');
        if (document.querySelectorAll('.material-input-row').length > 1) {
            row.remove();
            this.calculate();
        }
    },

    updateMaterialSelects() {
        const materials = Storage.getMaterials();
        const selects = document.querySelectorAll('.material-select');
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `
                <option value="">材料を選択</option>
                <option value="custom">直接入力</option>
                ${materials.map(m => `
                    <option value="${m.id}" 
                            data-price="${m.unitPrice}" 
                            data-unit="${m.unit}"
                            data-category="${m.category || ''}"
                            data-name="${m.name}">
                        ${m.name} (¥${m.unitPrice}/${m.unit})
                    </option>
                `).join('')}
            `;
            select.value = currentValue;
        });
    },

    handleMaterialChange(element) {
        const row = element.closest('.material-input-row');
        const select = row.querySelector('.material-select');
        const priceInput = row.querySelector('.material-price');
        
        if (element === select) {
            if (select.value === 'custom') {
                // 直接入力の場合、材料名入力欄を表示
                this.showCustomMaterialInput(row);
                priceInput.value = ''; // 単価をクリア
            } else if (select.value && select.value !== '') {
                // 既存材料の場合
                this.hideCustomMaterialInput(row);
                const option = select.querySelector(`option[value="${select.value}"]`);
                if (option) {
                    priceInput.value = option.dataset.price;
                }
            } else {
                // 未選択の場合
                this.hideCustomMaterialInput(row);
                priceInput.value = '';
            }
        }
    },


    showCustomMaterialInput(row) {
        // 既存のカスタム入力欄があれば削除
        const existingInput = row.querySelector('.custom-material-input');
        const existingCategory = row.querySelector('.custom-category-input');
        if (existingInput) return;
        
        // カスタム材料名入力欄を追加
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.className = 'custom-material-input';
        customInput.placeholder = '材料名を入力';
        customInput.required = true;
        
        // カテゴリー入力欄を追加（オプション）
        const categoryInput = document.createElement('input');
        categoryInput.type = 'text';
        categoryInput.className = 'custom-category-input';
        categoryInput.placeholder = 'カテゴリー（任意）';
        categoryInput.style.marginTop = '0.5rem';
        
        // selectの後に挿入
        const selectWrapper = row.querySelector('.material-select-wrapper');
        if (selectWrapper) {
            // 新しい検索型の場合
            selectWrapper.appendChild(customInput);
            selectWrapper.appendChild(categoryInput);
        } else {
            // 旧来の直接select型の場合（互換性のため）
            const select = row.querySelector('.material-select');
            select.parentNode.insertBefore(customInput, select.nextSibling);
            customInput.parentNode.insertBefore(categoryInput, customInput.nextSibling);
        }
    },

    hideCustomMaterialInput(row) {
        const customInput = row.querySelector('.custom-material-input');
        const categoryInput = row.querySelector('.custom-category-input');
        if (customInput) {
            customInput.remove();
        }
        if (categoryInput) {
            categoryInput.remove();
        }
    },

    calculate() {
        const sellingPrice = parseFloat(document.getElementById('selling-price').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shipping-fee').value) || 0;
        const indirectCosts = parseFloat(document.getElementById('indirect-costs').value) || 0;
        const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;
        
        // 材料費計算
        let materialCost = 0;
        document.querySelectorAll('.material-input-row').forEach(row => {
            const quantity = parseFloat(row.querySelector('.material-quantity').value) || 0;
            const price = parseFloat(row.querySelector('.material-price').value) || 0;
            materialCost += quantity * price;
        });
        
        // 手数料計算
        const commission = Math.floor(sellingPrice * (commissionRate / 100));
        
        // 実質手取り計算
        const totalCost = commission + materialCost + shippingFee + indirectCosts;
        const netIncome = sellingPrice - totalCost;
        
        // 利益率計算
        const profitRate = sellingPrice > 0 ? ((netIncome / sellingPrice) * 100).toFixed(1) : 0;
        
        // 結果表示
        document.getElementById('result-price').textContent = `¥${sellingPrice.toLocaleString()}`;
        document.getElementById('result-commission').textContent = `-¥${commission.toLocaleString()}`;
        document.getElementById('result-material').textContent = `-¥${materialCost.toLocaleString()}`;
        document.getElementById('result-shipping').textContent = `-¥${shippingFee.toLocaleString()}`;
        document.getElementById('result-indirect').textContent = `-¥${indirectCosts.toLocaleString()}`;
        document.getElementById('result-net').textContent = `¥${netIncome.toLocaleString()}`;
        document.getElementById('result-profit-rate').textContent = `${profitRate}%`;
        
        // 利益に応じて色を変更
        const netElement = document.getElementById('result-net');
        if (netIncome > 0) {
            netElement.style.color = 'var(--success-color)';
        } else if (netIncome < 0) {
            netElement.style.color = 'var(--danger-color)';
        } else {
            netElement.style.color = 'var(--text-primary)';
        }

        // 逆算パネルが表示中なら逆算も更新
        const reversePanel = document.getElementById('reverse-calc-panel');
        if (reversePanel && reversePanel.style.display !== 'none') {
            this.calculateReverse();
        }

        // 残り作成可能数を表示
        this.showRemainingProduction();
    },

    calculateReverse() {
        const target = parseFloat(document.getElementById('target-income').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shipping-fee').value) || 0;
        const indirectCosts = parseFloat(document.getElementById('indirect-costs').value) || 0;
        const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;

        // 材料費計算
        let materialCost = 0;
        document.querySelectorAll('.material-input-row').forEach(row => {
            const quantity = parseFloat(row.querySelector('.material-quantity').value) || 0;
            const price = parseFloat(row.querySelector('.material-price').value) || 0;
            materialCost += quantity * price;
        });

        const costs = materialCost + shippingFee + indirectCosts;
        const rate = commissionRate / 100;

        // price = ceil((target + costs) / (1 - rate))
        let requiredPrice = 0;
        if (rate < 1) {
            requiredPrice = Math.ceil((target + costs) / (1 - rate));
        }

        const commission = Math.floor(requiredPrice * rate);

        document.getElementById('reverse-price').textContent = `¥${requiredPrice.toLocaleString()}`;
        document.getElementById('reverse-commission').textContent = `-¥${commission.toLocaleString()}`;
        document.getElementById('reverse-material').textContent = `-¥${materialCost.toLocaleString()}`;
        document.getElementById('reverse-shipping').textContent = `-¥${shippingFee.toLocaleString()}`;
        document.getElementById('reverse-indirect').textContent = `-¥${indirectCosts.toLocaleString()}`;
        document.getElementById('reverse-net').textContent = `¥${target.toLocaleString()}`;
    },

    getMaterialsData() {
        const materialsData = [];
        document.querySelectorAll('.material-input-row').forEach(row => {
            const select = row.querySelector('.material-select');
            const quantity = parseFloat(row.querySelector('.material-quantity').value) || 0;
            const unitPrice = parseFloat(row.querySelector('.material-price').value) || 0;
            
            if (select.value && quantity > 0) {
                const material = {
                    quantity,
                    unitPrice,
                    totalPrice: quantity * unitPrice
                };
                
                if (select.value === 'custom') {
                    // カスタム材料名入力欄から名前を取得
                    const customInput = row.querySelector('.custom-material-input');
                    const categoryInput = row.querySelector('.custom-category-input');
                    material.name = customInput ? customInput.value : '直接入力材料';
                    material.id = null;
                    material.category = categoryInput && categoryInput.value ? categoryInput.value : '直接入力';
                } else {
                    const option = select.querySelector(`option[value="${select.value}"]`);
                    material.id = select.value;
                    material.name = option.dataset.name || option.textContent.split(' (')[0];
                    material.unit = option.dataset.unit;
                    material.category = option.dataset.category || 'その他';  // カテゴリー情報を取得
                }
                
                materialsData.push(material);
            }
        });
        return materialsData;
    },

    // 編集用データ読み込み
    loadSaleForEdit(id) {
        const sale = Storage.getSales().find(s => s.id === id);
        if (!sale) return;

        this.editingId = id;
        
        // フォームにデータを設定
        document.getElementById('product-name').value = sale.productName;
        document.getElementById('selling-price').value = sale.sellingPrice;
        document.getElementById('shipping-fee').value = sale.shippingFee;
        document.getElementById('indirect-costs').value = sale.indirectCosts || 0;
        document.getElementById('commission-rate').value = sale.commissionRate;

        // プラットフォームを復元（後方互換: platformなしはmercari）
        const platform = sale.platform || 'mercari';
        document.getElementById('platform').value = platform;

        // 日付を設定
        const dateInput = document.getElementById('sale-date');
        if (dateInput && sale.date) {
            const date = new Date(sale.date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            dateInput.value = `${year}-${month}-${day}`;
        }

        // 材料データを読み込み
        this.loadMaterialsData(sale.materials);
        
        // ボタンテキストを変更
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '更新';
        submitBtn.className = 'primary-btn';
        
        // キャンセルボタンを追加
        this.addCancelButton();
        
        // 計算実行
        this.calculate();
    },

    loadMaterialsData(materials) {
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        
        if (materials.length === 0) {
            this.addMaterialRow();
            return;
        }
        
        materials.forEach(material => {
            const row = document.createElement('div');
            row.className = 'material-input-row';
            
            row.innerHTML = `
                <div class="material-select-wrapper">
                    <input type="text" 
                           class="material-search" 
                           placeholder="材料を検索..."
                           autocomplete="off"
                           value="${material.name}">
                    <select class="material-select" style="display: none;">
                        <option value="">材料を選択</option>
                        <option value="custom">直接入力</option>
                    </select>
                    <div class="material-dropdown" style="display: none;"></div>
                </div>
                <input type="number" class="material-quantity" placeholder="数量" min="0" step="0.01" value="${material.quantity}">
                <input type="number" class="material-price" placeholder="単価" min="0" step="0.01" value="${material.unitPrice}">
                <button type="button" class="remove-material-btn">×</button>
            `;
            
            container.appendChild(row);
            this.setupMaterialSearch(row);
        });
        
        // 材料選択肢を更新
        this.updateMaterialSelects();
        
        // 材料データを設定
        const rows = container.querySelectorAll('.material-input-row');
        materials.forEach((material, index) => {
            const row = rows[index];
            const select = row.querySelector('.material-select');
            
            if (material.id) {
                // 登録済み材料
                select.value = material.id;
            } else {
                // 直接入力材料
                select.value = 'custom';
                this.showCustomMaterialInput(row);
                const customInput = row.querySelector('.custom-material-input');
                const categoryInput = row.querySelector('.custom-category-input');
                if (customInput) {
                    customInput.value = material.name;
                }
                if (categoryInput && material.category) {
                    categoryInput.value = material.category;
                }
            }
        });
    },

    addCancelButton() {
        // 既存のキャンセルボタンがあれば削除
        const existingCancel = document.getElementById('cancel-edit-btn');
        if (existingCancel) {
            existingCancel.remove();
        }
        
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.className = 'secondary-btn';
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.style.marginTop = '0.5rem';
        
        cancelBtn.addEventListener('click', () => {
            this.cancelEdit();
        });
        
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    },

    cancelEdit() {
        this.editingId = null;

        // フォームリセット
        this.form.reset();
        this.loadDefaults();
        this.setDefaultDate(); // 日付も現在に戻す

        // 材料入力をリセット
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        this.addMaterialRow();

        // ボタンを元に戻す
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '保存';

        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }

        this.renderShippingTemplates();
        this.calculate();
    },

    updateSale() {
        // 旧データの在庫を復元
        const oldSale = Storage.getSales().find(s => s.id === this.editingId);
        if (oldSale && oldSale.materials) {
            this.restoreMaterialStock(oldSale.materials);
        }

        const productName = document.getElementById('product-name').value;
        const sellingPrice = parseFloat(document.getElementById('selling-price').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shipping-fee').value) || 0;
        const indirectCosts = parseFloat(document.getElementById('indirect-costs').value) || 0;
        const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;
        const platform = document.getElementById('platform').value;

        // 日付を取得
        const saleDateInput = document.getElementById('sale-date');
        const saleDate = saleDateInput ? new Date(saleDateInput.value).toISOString() : new Date().toISOString();

        const materials = this.getMaterialsData();
        const materialCost = materials.reduce((sum, m) => sum + m.totalPrice, 0);
        const commission = Math.floor(sellingPrice * (commissionRate / 100));
        const totalCost = commission + materialCost + shippingFee + indirectCosts;
        const netIncome = sellingPrice - totalCost;
        const profitRate = sellingPrice > 0 ? ((netIncome / sellingPrice) * 100).toFixed(1) : 0;

        const updatedSale = {
            productName,
            sellingPrice,
            materials,
            materialCost,
            shippingFee,
            indirectCosts,
            commissionRate,
            commission,
            netIncome,
            profitRate: parseFloat(profitRate),
            platform,
            date: saleDate // 日付を更新
        };
        
        Storage.updateSale(this.editingId, updatedSale);

        // 新データの在庫を減算
        this.deductMaterialStock(materials);

        // 編集モードを終了
        this.editingId = null;
        
        // フォームリセット
        this.form.reset();
        this.loadDefaults();
        this.setDefaultDate();
        
        // 材料入力をリセット
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        this.addMaterialRow();
        
        // ボタンを元に戻す
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '保存';
        
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }
        
        // 履歴タブに切り替え
        document.querySelector('[data-tab="history"]').click();
        
        // 目標データも更新
        if (typeof Goals !== 'undefined') {
            Goals.render();
        }
        
        // 成功メッセージ
        this.showNotification('更新しました！');
    },

    saveSale() {
        const productName = document.getElementById('product-name').value;
        const sellingPrice = parseFloat(document.getElementById('selling-price').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shipping-fee').value) || 0;
        const indirectCosts = parseFloat(document.getElementById('indirect-costs').value) || 0;
        const commissionRate = parseFloat(document.getElementById('commission-rate').value) || 0;
        const platform = document.getElementById('platform').value;

        // 日付を取得
        const saleDateInput = document.getElementById('sale-date');
        const saleDate = saleDateInput ? new Date(saleDateInput.value).toISOString() : new Date().toISOString();

        const materials = this.getMaterialsData();
        const materialCost = materials.reduce((sum, m) => sum + m.totalPrice, 0);
        const commission = Math.floor(sellingPrice * (commissionRate / 100));
        const totalCost = commission + materialCost + shippingFee + indirectCosts;
        const netIncome = sellingPrice - totalCost;
        const profitRate = sellingPrice > 0 ? ((netIncome / sellingPrice) * 100).toFixed(1) : 0;

        const sale = {
            productName,
            sellingPrice,
            materials,
            materialCost,
            shippingFee,
            indirectCosts,
            commissionRate,
            commission,
            netIncome,
            profitRate: parseFloat(profitRate),
            platform,
            date: saleDate // カスタム日付を使用
        };
        
        Storage.saveSale(sale);

        // 在庫減算
        this.deductMaterialStock(materials);

        // エフェクト表示
        if (typeof Effects !== 'undefined') {
            Effects.showSaveEffect(sale.sellingPrice);
        }
        
        // 目標データを更新（売却日の年月に基づいて）
        if (typeof Goals !== 'undefined') {
            const saleYearMonth = saleDate.slice(0, 7);
            const goal = Storage.getGoal(saleYearMonth);
            
            // 売上データを再取得して正確に計算
            const allSales = Storage.getSales();
            const monthSales = allSales.filter(s => s.date.startsWith(saleYearMonth));
            
            goal.currentAmount = monthSales.reduce((sum, s) => sum + s.sellingPrice, 0);
            goal.salesCount = monthSales.length;
            
            Storage.saveGoal(saleYearMonth, goal);
            
            // 記録も即座に更新
            Goals.updateRecords();
        }
        
        // フォームリセット
        this.form.reset();
        this.loadDefaults();
        this.setDefaultDate();
        
        // 材料入力をリセット
        const container = document.getElementById('material-inputs');
        container.innerHTML = '';
        this.addMaterialRow();
        
        // 履歴タブに切り替え
        document.querySelector('[data-tab="history"]').click();
        
        // 成功メッセージ
        this.showNotification('保存しました！');
    },

    deductMaterialStock(materials) {
        if (!materials || materials.length === 0) return;
        const allMaterials = Storage.getMaterials();
        materials.forEach(m => {
            if (m.id) {
                const stored = allMaterials.find(sm => sm.id === m.id);
                if (stored && stored.stock != null) {
                    stored.stock = Math.max(0, stored.stock - (m.quantity || 0));
                    Storage.updateMaterial(stored.id, stored);
                }
            }
        });
        if (typeof Materials !== 'undefined') {
            Materials.renderMaterialsList();
        }
    },

    restoreMaterialStock(materials) {
        if (!materials || materials.length === 0) return;
        const allMaterials = Storage.getMaterials();
        materials.forEach(m => {
            if (m.id) {
                const stored = allMaterials.find(sm => sm.id === m.id);
                if (stored && stored.stock != null) {
                    stored.stock = stored.stock + (m.quantity || 0);
                    Storage.updateMaterial(stored.id, stored);
                }
            }
        });
        if (typeof Materials !== 'undefined') {
            Materials.renderMaterialsList();
        }
    },

    showRemainingProduction() {
        // 既存の表示を削除
        const existing = document.getElementById('remaining-production');
        if (existing) existing.remove();

        const materialsData = this.getMaterialsData();
        if (materialsData.length === 0) return;

        const allMaterials = Storage.getMaterials();
        let minProduction = Infinity;
        let limitingMaterial = '';

        materialsData.forEach(m => {
            if (m.id) {
                const stored = allMaterials.find(sm => sm.id === m.id);
                if (stored && stored.stock != null && m.quantity > 0) {
                    const possible = Math.floor(stored.stock / m.quantity);
                    if (possible < minProduction) {
                        minProduction = possible;
                        limitingMaterial = stored.name;
                    }
                }
            }
        });

        if (minProduction < Infinity) {
            const indicator = document.createElement('div');
            indicator.id = 'remaining-production';
            indicator.className = 'remaining-production-indicator';
            indicator.textContent = `残り ${minProduction} 個作成可能（${limitingMaterial}が制限）`;
            const resultBox = document.querySelector('.result-box');
            if (resultBox) {
                resultBox.parentNode.insertBefore(indicator, resultBox.nextSibling);
            }
        }
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'};
            color: white;
            padding: 1rem 2rem;
            border-radius: var(--border-radius);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideUp 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
};

// グローバルスコープに公開（onclickイベント用）
window.Calculator = Calculator;
