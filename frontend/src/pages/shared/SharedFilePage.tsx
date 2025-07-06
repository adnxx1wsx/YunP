import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Share2 } from 'lucide-react';

const SharedFilePage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>分享文件 - YunP</title>
        <meta name="description" content="查看分享的文件" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-12 max-w-md w-full mx-4">
          <div className="text-center">
            <Share2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              文件分享功能开发中
            </h3>
            <p className="text-gray-500">
              文件分享查看功能正在开发中，敬请期待！
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SharedFilePage;
