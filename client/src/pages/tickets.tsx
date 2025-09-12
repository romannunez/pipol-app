import React from 'react';

export default function Tickets() {
  return (
    <div className="min-h-screen bg-white pt-4 pb-24">
      <div className="max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Tickets</h1>
        
        <div className="bg-gray-50 rounded-lg shadow-sm p-6 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.5 9.75A3.75 3.75 0 0011.75 6H6a2.25 2.25 0 00-2.25 2.25v6.75A2.25 2.25 0 006 17.25h5.75A3.75 3.75 0 0015.5 14v-4.25z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tienes tickets aún
          </h3>
          <p className="text-gray-600 mb-4">
            Cuando te inscribas a eventos, tus tickets aparecerán aquí.
          </p>
        </div>
      </div>
    </div>
  );
}