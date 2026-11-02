export type VehicleTypeEnum =
  | 'CAR'
  | 'SUV'
  | 'PICKUP'
  | 'LARGE_PICKUP'
  | 'UTILITY';

export type VehicleLabelEnum =
  | 'Auto'
  | 'SUV'
  | 'Camioneta'
  | 'Camioneta Grande'
  | 'Trafic / Utilitario';

export interface Database {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string;
          user_id: string;
          vehicle_details: string;
          service_type: string;
          date: string;
          time: string;
          status: string;
          created_at: string;
          updated_at: string;
          client_name: string | null;
          client_email: string | null;
          client_phone: string | null;
          price: number;
          notes: string | null;
          nombre_cliente: string | null;
          vehiculo: string | null;
          categoria: VehicleTypeEnum | string | null;
          precio: number | null;
          indicaciones: string | null;
          estado: string | null;
          fecha_creacion: string | null;
          reminder_24h_sent: boolean | null;
          reminder_24h_sent_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_details: string;
          service_type: string;
          date: string;
          time: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          client_name?: string | null;
          client_email?: string | null;
          client_phone?: string | null;
          price?: number;
          notes?: string | null;
          nombre_cliente?: string | null;
          vehiculo?: string | null;
          categoria?: VehicleTypeEnum | string | null;
          precio?: number | null;
          indicaciones?: string | null;
          estado?: string | null;
          fecha_creacion?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      turnos: {
        Row: {
          id: string;
          user_id: string;
          nombre_cliente: string;
          vehiculo: string;
          categoria: VehicleTypeEnum | string;
          precio: number;
          indicaciones: string | null;
          estado: string;
          fecha_creacion: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre_cliente: string;
          vehiculo: string;
          categoria: VehicleTypeEnum | string;
          precio: number;
          indicaciones?: string | null;
          estado?: string;
          fecha_creacion?: string;
        };
        Update: Partial<Database['public']['Tables']['turnos']['Insert']>;
      };
    };
    Enums: {
      vehicle_type: VehicleTypeEnum;
    };
  };
}
