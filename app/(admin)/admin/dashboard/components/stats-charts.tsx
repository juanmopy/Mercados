'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  byOperator: { operatorName: string; count: number }[];
  byHour: { hour: string; count: number }[];
}

export function StatsCharts({ byOperator, byHour }: Readonly<Props>) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* By operator */}
      <div className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h3 className="text-foreground font-bold mb-4">Entregas por operador</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byOperator ?? []}>
              <XAxis dataKey="operatorName" tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="Entregas" fill="#60B5FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By hour */}
      <div className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h3 className="text-foreground font-bold mb-4">Entregas por hora</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour ?? []}>
              <XAxis dataKey="hour" tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="Entregas" fill="#80D8C3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
