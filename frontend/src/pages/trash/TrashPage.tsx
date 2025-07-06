import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Trash2 } from 'lucide-react';

const TrashPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>回收站 - YunP</title>
        <meta name="description" content="管理已删除的文件和文件夹" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">回收站</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-12">
          <div className="text-center">
            <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              回收站功能开发中
            </h3>
            <p className="text-gray-500">
              文件恢复、永久删除等功能正在开发中，敬请期待！
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TrashPage;
