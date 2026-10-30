import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'HopeEquipment',
  description: '设备管理系统教程文档',
  base: '/hopeequipment/',
  
  markdown: {
    lineNumbers: true
  },
  
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '教程', link: '/doc/01-overview' },
      {
        text: '详细实现',
        items: [
          { text: '数据库篇', link: '/doc/02-database-detail' },
          { text: '后端篇', link: '/doc/03-backend-detail' },
          { text: '前端篇', link: '/doc/04-frontend-detail' },
          { text: '部署篇', link: '/doc/05-deploy' }
        ]
      },
      {
        text: 'Vibe Coding',
        items: [
          { text: '数据库篇', link: '/doc/02-database-coding' },
          { text: '后端篇', link: '/doc/03-backend-coding' },
          { text: '前端篇', link: '/doc/04-frontend-coding' }
        ]
      }
    ],
    
    sidebar: {
      '/doc/': [
        {
          text: '开始',
          items: [
            { text: '概况篇', link: '/doc/01-overview' }
          ]
        },
        {
          text: '数据库篇',
          items: [
            { text: '详细实现', link: '/doc/02-database-detail' },
            { text: 'Vibe Coding', link: '/doc/02-database-coding' }
          ]
        },
        {
          text: '后端篇',
          items: [
            { text: '详细实现', link: '/doc/03-backend-detail' },
            { text: 'Vibe Coding', link: '/doc/03-backend-coding' }
          ]
        },
        {
          text: '前端篇',
          items: [
            { text: '详细实现', link: '/doc/04-frontend-detail' },
            { text: 'Vibe Coding', link: '/doc/04-frontend-coding' }
          ]
        },
        {
          text: '部署篇',
          items: [
            { text: '部署指南', link: '/doc/05-deploy' }
          ]
        }
      ]
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/jcchan23/hopeequipment' }
    ],
    
    search: {
      provider: 'local'
    },
    
    outline: {
      level: [2, 3],
      label: '页面导航'
    }
  }
})
