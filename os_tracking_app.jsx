import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Download, BarChart3, Eye, EyeOff, Save, Trash2, Edit2, X } from 'lucide-react';

export default function OSTrackingApp() {
  const [currentView, setCurrentView] = useState('tracking'); // 'tracking' or 'dashboard'
  const [unitPrice, setUnitPrice] = useState(2300);
  const [activePeriods, setActivePeriods] = useState(['H2-2024', 'H1-2025', 'H2-2025']);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [projects, setProjects] = useState([
    {
      id: 1,
      company: 'ISJ (日本オンサイト)',
      projectType: '開発設計・機械設計',
      software: 'ー',
      plan: {
        'H2-2024': { 8: 0, 9: 50, 10: 50, 11: 100, 12: 100 },
        'H1-2025': { 1: 160, 2: 160, 3: 160, 4: 160, 5: 160, 6: 160 },
        'H2-2025': { 7: 160, 8: 160, 9: 160, 10: 160, 11: 160, 12: 160 }
      },
      actual: {
        'H2-2024': { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
        'H1-2025': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        'H2-2025': { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    },
    {
      id: 2,
      company: 'ISJ (HCM)',
      projectType: '開発設計・機械設計',
      software: 'CATIA',
      plan: {
        'H2-2024': { 8: 0, 9: 50, 10: 50, 11: 100, 12: 100 },
        'H1-2025': { 1: 190, 2: 220, 3: 250, 4: 280, 5: 310, 6: 320 },
        'H2-2025': { 7: 320, 8: 320, 9: 320, 10: 320, 11: 320, 12: 320 }
      },
      actual: {
        'H2-2024': { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
        'H1-2025': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        'H2-2025': { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    },
    {
      id: 3,
      company: 'GLW (LM)',
      projectType: '電気自動車のベースデザイン',
      software: 'CATIA',
      plan: {
        'H2-2024': { 8: 0, 9: 150, 10: 150, 11: 0, 12: 0 },
        'H1-2025': { 1: 0, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50 },
        'H2-2025': { 7: 50, 8: 50, 9: 50, 10: 50, 11: 50, 12: 50 }
      },
      actual: {
        'H2-2024': { 8: 3, 9: 74, 10: 109, 11: 150, 12: 446 },
        'H1-2025': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        'H2-2025': { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    },
    {
      id: 4,
      company: 'GLW (FALTEC)',
      projectType: '外装部品設計',
      software: 'CATIA',
      plan: {
        'H2-2024': { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
        'H1-2025': { 1: 100, 2: 100, 3: 160, 4: 160, 5: 160, 6: 160 },
        'H2-2025': { 7: 160, 8: 160, 9: 160, 10: 160, 11: 160, 12: 160 }
      },
      actual: {
        'H2-2024': { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
        'H1-2025': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        'H2-2025': { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    }
  ]);

  const periodMonths = {
    'H2-2024': [8, 9, 10, 11, 12],
    'H1-2025': [1, 2, 3, 4, 5, 6],
    'H2-2025': [7, 8, 9, 10, 11, 12],
    'H1-2026': [1, 2, 3, 4, 5, 6]
  };

  const calculateTotal = (data, period) => {
    return Object.values(data[period] || {}).reduce((sum, val) => sum + (val || 0), 0);
  };

  const calculatePeriodTotals = (type, period) => {
    return projects.reduce((sum, project) => {
      return sum + calculateTotal(project[type], period);
    }, 0);
  };

  const calculateGrandTotal = (type) => {
    return activePeriods.reduce((sum, period) => {
      return sum + calculatePeriodTotals(type, period);
    }, 0);
  };

  const updateProjectHours = (projectId, type, period, month, value) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          [type]: {
            ...p[type],
            [period]: {
              ...p[type][period],
              [month]: parseInt(value) || 0
            }
          }
        };
      }
      return p;
    }));
  };

  const addNewProject = (projectData) => {
    const newProject = {
      id: Date.now(),
      ...projectData,
      plan: {},
      actual: {}
    };
    
    // Initialize plan and actual for all periods
    Object.keys(periodMonths).forEach(period => {
      newProject.plan[period] = {};
      newProject.actual[period] = {};
      periodMonths[period].forEach(month => {
        newProject.plan[period][month] = 0;
        newProject.actual[period][month] = 0;
      });
    });
    
    setProjects([...projects, newProject]);
    setShowAddProject(false);
  };

  const deleteProject = (projectId) => {
    if (confirm('このプロジェクトを削除してもよろしいですか？')) {
      setProjects(projects.filter(p => p.id !== projectId));
    }
  };

  const exportToExcel = () => {
    alert('Excel出力機能は実装中です。Supabaseと連携後に追加されます。');
  };

  const ProjectForm = ({ project, onSave, onCancel }) => {
    const [formData, setFormData] = useState(project || {
      company: '',
      projectType: '',
      software: ''
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {project ? 'プロジェクト編集' : '新規プロジェクト追加'}
            </h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                社名 (Company)
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: ISJ (HCM)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                業務内容 (Project Type)
              </label>
              <input
                type="text"
                value={formData.projectType}
                onChange={(e) => setFormData({...formData, projectType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 開発設計・機械設計"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                使用ソフト (Software)
              </label>
              <input
                type="text"
                value={formData.software}
                onChange={(e) => setFormData({...formData, software: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: CATIA"
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => onSave(formData)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              保存
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 font-medium"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    const dashboardData = projects.map(project => {
      const totalPlan = activePeriods.reduce((sum, period) => {
        return sum + calculateTotal(project.plan, period);
      }, 0);
      
      const totalActual = activePeriods.reduce((sum, period) => {
        return sum + calculateTotal(project.actual, period);
      }, 0);
      
      const achievement = totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(1) : 0;
      const revenue = totalActual * unitPrice;
      
      return {
        ...project,
        totalPlan,
        totalActual,
        achievement,
        revenue
      };
    });

    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
            <div className="text-sm opacity-90 mb-1">総計画時間</div>
            <div className="text-3xl font-bold">{calculateGrandTotal('plan').toLocaleString()}</div>
            <div className="text-xs opacity-75 mt-1">hours</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
            <div className="text-sm opacity-90 mb-1">総実績時間</div>
            <div className="text-3xl font-bold">{calculateGrandTotal('actual').toLocaleString()}</div>
            <div className="text-xs opacity-75 mt-1">hours</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
            <div className="text-sm opacity-90 mb-1">達成率</div>
            <div className="text-3xl font-bold">
              {calculateGrandTotal('plan') > 0 
                ? ((calculateGrandTotal('actual') / calculateGrandTotal('plan')) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
            <div className="text-sm opacity-90 mb-1">総収益</div>
            <div className="text-3xl font-bold">
              ¥{(calculateGrandTotal('actual') * unitPrice).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">プロジェクト別実績</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">社名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">業務内容</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">計画時間</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">実績時間</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">達成率</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">収益</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dashboardData.map((project, index) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.company}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{project.projectType}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                      {project.totalPlan.toLocaleString()}h
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                      {project.totalActual.toLocaleString()}h
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.achievement >= 100 ? 'bg-green-100 text-green-800' :
                        project.achievement >= 80 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {project.achievement}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold font-mono">
                      ¥{project.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">OS業務受託管理システム</h1>
              <p className="text-sm opacity-90 mt-1">Outsourcing Management System</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs opacity-75">単価</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">¥</span>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseInt(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-sm bg-white bg-opacity-20 border border-white border-opacity-30 rounded text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  />
                  <span className="text-sm">/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 pb-4 flex gap-2">
          <button
            onClick={() => setCurrentView('tracking')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              currentView === 'tracking'
                ? 'bg-white text-blue-900'
                : 'bg-white bg-opacity-10 text-white hover:bg-opacity-20'
            }`}
          >
            <Calendar className="inline-block mr-2" size={16} />
            時間追跡
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              currentView === 'dashboard'
                ? 'bg-white text-blue-900'
                : 'bg-white bg-opacity-10 text-white hover:bg-opacity-20'
            }`}
          >
            <BarChart3 className="inline-block mr-2" size={16} />
            ダッシュボード
          </button>
        </div>
      </div>

      {currentView === 'dashboard' ? (
        <DashboardView />
      ) : (
        <div className="p-6">
          {/* Actions Bar */}
          <div className="mb-4 flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddProject(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors"
              >
                <Plus size={18} />
                プロジェクト追加
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium shadow-md transition-colors"
              >
                <Download size={18} />
                Excel出力
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              表示期間: {activePeriods.join(', ')}
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                    <th className="border border-blue-400 px-3 py-3 sticky left-0 bg-blue-600 z-20" rowSpan="2">
                      操作
                    </th>
                    <th className="border border-blue-400 px-3 py-3 sticky left-16 bg-blue-600 z-20 min-w-[140px]" rowSpan="2">
                      社名
                    </th>
                    <th className="border border-blue-400 px-3 py-3 min-w-[120px]" rowSpan="2">
                      業務内容
                    </th>
                    <th className="border border-blue-400 px-2 py-3 min-w-[80px]" rowSpan="2">
                      ソフト
                    </th>
                    <th className="border border-blue-400 px-2 py-3" rowSpan="2"></th>
                    {activePeriods.map(period => (
                      <th key={period} className="border border-blue-400 px-2 py-2" colSpan={periodMonths[period].length + 1}>
                        {period}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                    {activePeriods.map(period => (
                      <React.Fragment key={period}>
                        {periodMonths[period].map(month => (
                          <th key={month} className="border border-blue-400 px-2 py-2 min-w-[70px]">
                            {month}月
                          </th>
                        ))}
                        <th className="border border-blue-400 px-2 py-2 bg-blue-700 min-w-[80px]">計</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                
                <tbody>
                  {projects.map((project, index) => (
                    <React.Fragment key={project.id}>
                      {/* Plan Row */}
                      <tr className="hover:bg-blue-50">
                        <td className="border border-gray-300 px-2 py-2 sticky left-0 bg-white z-10" rowSpan="2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingProject(project)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="編集"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteProject(project.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="削除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-2 py-2 bg-yellow-50 font-semibold whitespace-pre-line sticky left-16 z-10" rowSpan="2">
                          {project.company}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 bg-blue-50 text-left whitespace-pre-line" rowSpan="2">
                          {project.projectType}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center bg-blue-100 font-semibold" rowSpan="2">
                          {project.software}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-left font-semibold bg-gray-50">
                          計画
                        </td>
                        {activePeriods.map(period => (
                          <React.Fragment key={period}>
                            {periodMonths[period].map(month => (
                              <td key={month} className="border border-gray-300 px-1 py-1">
                                <input
                                  type="number"
                                  value={project.plan[period]?.[month] || 0}
                                  onChange={(e) => updateProjectHours(project.id, 'plan', period, month, e.target.value)}
                                  className="w-full px-1 py-1 text-right text-xs border-0 focus:ring-2 focus:ring-blue-500 rounded"
                                />
                              </td>
                            ))}
                            <td className="border border-gray-300 px-2 py-2 text-right bg-blue-100 font-bold">
                              {calculateTotal(project.plan, period)}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                      
                      {/* Actual Row */}
                      <tr className="bg-yellow-50 hover:bg-yellow-100">
                        <td className="border border-gray-300 px-2 py-2 text-left font-semibold bg-yellow-100">
                          実績
                        </td>
                        {activePeriods.map(period => (
                          <React.Fragment key={period}>
                            {periodMonths[period].map(month => (
                              <td key={month} className="border border-gray-300 px-1 py-1">
                                <input
                                  type="number"
                                  value={project.actual[period]?.[month] || 0}
                                  onChange={(e) => updateProjectHours(project.id, 'actual', period, month, e.target.value)}
                                  className="w-full px-1 py-1 text-right text-xs border-0 bg-yellow-50 focus:ring-2 focus:ring-orange-500 rounded"
                                />
                              </td>
                            ))}
                            <td className="border border-gray-300 px-2 py-2 text-right bg-yellow-200 font-bold">
                              {calculateTotal(project.actual, period)}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </React.Fragment>
                  ))}
                  
                  {/* Total Rows */}
                  <tr className="bg-blue-100 font-bold">
                    <td className="border border-gray-300 px-2 py-3 text-center sticky left-0 bg-blue-100 z-10" colSpan="4">
                      Total (合計)
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-left bg-blue-200">計画</td>
                    {activePeriods.map(period => (
                      <React.Fragment key={period}>
                        {periodMonths[period].map(month => {
                          const monthTotal = projects.reduce((sum, project) => {
                            return sum + (project.plan[period]?.[month] || 0);
                          }, 0);
                          return (
                            <td key={month} className="border border-gray-300 px-2 py-2 text-right">
                              {monthTotal}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-2 py-2 text-right bg-blue-600 text-white">
                          {calculatePeriodTotals('plan', period)}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                  
                  <tr className="bg-yellow-200 font-bold">
                    <td className="border border-gray-300 px-2 py-3 text-center sticky left-0 bg-yellow-200 z-10" colSpan="4">
                      Total (合計)
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-left bg-yellow-300">実績</td>
                    {activePeriods.map(period => (
                      <React.Fragment key={period}>
                        {periodMonths[period].map(month => {
                          const monthTotal = projects.reduce((sum, project) => {
                            return sum + (project.actual[period]?.[month] || 0);
                          }, 0);
                          return (
                            <td key={month} className="border border-gray-300 px-2 py-2 text-right">
                              {monthTotal}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-2 py-2 text-right bg-orange-500 text-white">
                          {calculatePeriodTotals('actual', period)}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activePeriods.map(period => {
              const planHours = calculatePeriodTotals('plan', period);
              const actualHours = calculatePeriodTotals('actual', period);
              const expectedRevenue = planHours * unitPrice;
              const actualRevenue = actualHours * unitPrice;
              
              return (
                <div key={period} className="bg-white rounded-lg shadow p-4 border-t-4 border-blue-500">
                  <div className="text-sm font-bold text-gray-700 mb-3">{period}</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">計画:</span>
                      <span className="font-semibold">{planHours.toLocaleString()} hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">予想収益:</span>
                      <span className="font-semibold text-blue-600">¥{expectedRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-600">実績:</span>
                      <span className="font-semibold">{actualHours.toLocaleString()} hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">収益:</span>
                      <span className="font-semibold text-green-600">¥{actualRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Project Modal */}
      {(showAddProject || editingProject) && (
        <ProjectForm
          project={editingProject}
          onSave={(data) => {
            if (editingProject) {
              setProjects(projects.map(p => 
                p.id === editingProject.id ? { ...p, ...data } : p
              ));
              setEditingProject(null);
            } else {
              addNewProject(data);
            }
          }}
          onCancel={() => {
            setShowAddProject(false);
            setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}