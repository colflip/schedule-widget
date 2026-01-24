/**
 * 排课类型数据存储与管理（内存 + 本地缓存）
 * 共享给管理员端和教师端使用
 */
(function () {
    'use strict';

    const ScheduleTypesStore = {
        list: [],
        map: new Map(),
        loadedAt: null,
        cacheKey: 'schedule_types_cache_v1',

        /**
         * 加载排课类型数据
         * @param {Array} types - 排课类型数组
         */
        load(types) {
            if (!Array.isArray(types)) return;
            this.list = types.slice();
            this.map = new Map(types.map(t => [Number(t.id), t]));
            this.loadedAt = Date.now();
            try {
                const payload = { list: this.list, loadedAt: this.loadedAt };
                localStorage.setItem(this.cacheKey, JSON.stringify(payload));
            } catch (e) {
                console.warn('保存排课类型到缓存失败:', e);
            }
        },

        /**
         * 从本地缓存恢复排课类型数据
         * @returns {boolean} 是否成功从缓存恢复
         */
        fromCache() {
            try {
                const txt = localStorage.getItem(this.cacheKey);
                if (!txt) return false;
                const obj = JSON.parse(txt);
                if (!obj || !Array.isArray(obj.list)) return false;
                this.list = obj.list;
                this.map = new Map(this.list.map(t => [Number(t.id), t]));
                this.loadedAt = obj.loadedAt || Date.now();
                return true;
            } catch (e) {
                console.warn('从缓存加载排课类型失败:', e);
                return false;
            }
        },

        /**
         * 获取所有排课类型
         * @returns {Array} 排课类型数组
         */
        getAll() {
            return this.list.slice();
        },

        /**
         * 根据ID获取排课类型
         * @param {number} id - 排课类型ID
         * @returns {Object|undefined} 排课类型对象
         */
        getById(id) {
            return this.map.get(Number(id));
        },

        /**
         * 清空排课类型数据
         */
        clear() {
            this.list = [];
            this.map.clear();
            this.loadedAt = null;
        },

        /**
         * 确保排课类型数据已加载
         * 如果未加载，则从缓存或API加载
         * @returns {Promise<Array>} 排课类型数组
         */
        async ensureLoaded() {
            // 如果已有数据，直接返回
            if (this.list.length > 0) {
                return this.list;
            }

            // 尝试从缓存恢复
            const restored = this.fromCache();
            if (restored && this.list.length > 0) {
                return this.list;
            }

            // 从API加载
            try {
                if (!window.apiUtils || typeof window.apiUtils.get !== 'function') {
                    return [];
                }

                const fetched = await window.apiUtils.get('/schedule/types');
                if (Array.isArray(fetched)) {
                    this.load(fetched);
                    return this.list;
                }
            } catch (error) {
                // 静默失败，返回空数组
            }

            return [];
        }
    };

    // 暴露到全局，供统计插件和其他模块使用
    window.ScheduleTypesStore = ScheduleTypesStore;
})();

