// dashboard.js - ダッシュボード機能
const Dashboard = {
    init() {
        this.render();
    },

    render() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        this.renderGreeting(container);
        this.renderTodaySummary(container);
        this.renderMonthSummary(container);
        this.renderGoalProgress(container);
        this.renderRecentSales(container);
        this.renderBestDay(container);
    },

    renderGreeting(container) {
        const hour = new Date().getHours();
        let greeting = 'こんにちは';
        if (hour < 6) greeting = 'お疲れさまです';
        else if (hour < 12) greeting = 'おはようございます';
        else if (hour < 18) greeting = 'こんにちは';
        else greeting = 'こんばんは';

        const el = container.querySelector('.dashboard-greeting');
        if (el) el.textContent = greeting;
    },

    renderTodaySummary(container) {
        const sales = Storage.getSales();
        const today = new Date().toISOString().slice(0, 10);
        const todaySales = sales.filter(s => s.date.slice(0, 10) === today);

        const totalSales = todaySales.reduce((sum, s) => sum + s.sellingPrice, 0);
        const totalProfit = todaySales.reduce((sum, s) => sum + s.netIncome, 0);

        const countEl = container.querySelector('#dash-today-count');
        const salesEl = container.querySelector('#dash-today-sales');
        const profitEl = container.querySelector('#dash-today-profit');

        if (countEl) countEl.textContent = `${todaySales.length}件`;
        if (salesEl) salesEl.textContent = `¥${totalSales.toLocaleString()}`;
        if (profitEl) profitEl.textContent = `¥${totalProfit.toLocaleString()}`;
    },

    renderMonthSummary(container) {
        const sales = Storage.getSales();
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthSales = sales.filter(s => s.date.slice(0, 7) === yearMonth);

        const totalSales = monthSales.reduce((sum, s) => sum + s.sellingPrice, 0);
        const totalProfit = monthSales.reduce((sum, s) => sum + s.netIncome, 0);
        const avgProfit = monthSales.length > 0
            ? (monthSales.reduce((sum, s) => sum + s.profitRate, 0) / monthSales.length).toFixed(1)
            : 0;

        const countEl = container.querySelector('#dash-month-count');
        const salesEl = container.querySelector('#dash-month-sales');
        const profitEl = container.querySelector('#dash-month-profit');
        const avgEl = container.querySelector('#dash-month-avg');

        if (countEl) countEl.textContent = `${monthSales.length}件`;
        if (salesEl) salesEl.textContent = `¥${totalSales.toLocaleString()}`;
        if (profitEl) profitEl.textContent = `¥${totalProfit.toLocaleString()}`;
        if (avgEl) avgEl.textContent = `${avgProfit}%`;
    },

    renderGoalProgress(container) {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const goal = Storage.getGoal(yearMonth);
        const sales = Storage.getSales();
        const monthSales = sales.filter(s => s.date.slice(0, 7) === yearMonth);
        const currentAmount = monthSales.reduce((sum, s) => sum + s.sellingPrice, 0);

        const targetAmount = goal.targetAmount || 0;
        const percentage = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

        const barFill = container.querySelector('#dash-goal-fill');
        const percentEl = container.querySelector('#dash-goal-percent');
        const amountEl = container.querySelector('#dash-goal-amount');

        if (barFill) barFill.style.width = `${percentage}%`;
        if (percentEl) percentEl.textContent = `${percentage}%`;
        if (amountEl) {
            amountEl.textContent = targetAmount > 0
                ? `¥${currentAmount.toLocaleString()} / ¥${targetAmount.toLocaleString()}`
                : '目標未設定';
        }
    },

    renderRecentSales(container) {
        const sales = Storage.getSales();
        const recent = sales.slice(0, 3);
        const listEl = container.querySelector('#dash-recent-list');
        if (!listEl) return;

        if (recent.length === 0) {
            listEl.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">まだ売上がありません</p>';
            return;
        }

        const platformNames = { mercari: 'メルカリ', yahoo: 'Yahoo!フリマ', custom: 'カスタム' };

        listEl.innerHTML = recent.map(sale => {
            const date = new Date(sale.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const platformName = platformNames[sale.platform] || 'メルカリ';
            return `
                <div class="dashboard-recent-item">
                    <div class="dashboard-recent-header">
                        <span class="dashboard-recent-name">${sale.productName}</span>
                        <span class="dashboard-recent-date">${dateStr}</span>
                    </div>
                    <div class="dashboard-recent-detail">
                        <span>${platformName}</span>
                        <span>¥${sale.sellingPrice.toLocaleString()} → 手取り ¥${sale.netIncome.toLocaleString()}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderBestDay(container) {
        const sales = Storage.getSales();
        if (sales.length === 0) {
            const el = container.querySelector('#dash-best-day');
            if (el) el.textContent = '-';
            return;
        }

        // 日別売上を集計
        const dailySales = {};
        sales.forEach(s => {
            const day = s.date.slice(0, 10);
            if (!dailySales[day]) dailySales[day] = 0;
            dailySales[day] += s.sellingPrice;
        });

        let bestDay = '';
        let bestAmount = 0;
        Object.entries(dailySales).forEach(([day, amount]) => {
            if (amount > bestAmount) {
                bestAmount = amount;
                bestDay = day;
            }
        });

        const bestDayEl = container.querySelector('#dash-best-day');
        const bestAmountEl = container.querySelector('#dash-best-amount');

        if (bestDayEl && bestDay) {
            const d = new Date(bestDay);
            bestDayEl.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
        }
        if (bestAmountEl) bestAmountEl.textContent = `¥${bestAmount.toLocaleString()}`;
    }
};

// グローバルスコープに公開
window.Dashboard = Dashboard;
