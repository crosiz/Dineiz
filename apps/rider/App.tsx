import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, FlatList } from 'react-native';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';

type Order = { id: string; orderNumber: string; status: string; deliveryAddress?: string | null };

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export default function App() {
  const [token, setToken] = useState('');
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);

  const socket = useMemo(() => io(API_URL.replace('8080', '8080'), { autoConnect: false, transports: ['websocket'] }), []);

  async function loadOrders() {
    // Minimal placeholder: expects rider-auth to be added later; for now uses a token header if provided.
    const res = await fetch(`${API_URL}/api/orders?limit=20${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include' as any,
    });
    const data = await res.json();
    setOrders(data?.data ?? []);
  }

  async function startTracking() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    socket.connect();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (pos) => {
        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
        };
        socket.emit('rider:location', payload);
      }
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ color: '#f1f5f9', fontSize: 20, fontWeight: '700' }}>Dineiz Go Rider</Text>
        <Text style={{ color: '#64748b' }}>Auth + orders list + GPS tracking (scaffold).</Text>

        <View style={{ gap: 8 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Branch ID (optional)</Text>
          <TextInput
            value={branchId}
            onChangeText={setBranchId}
            placeholder="branchId"
            placeholderTextColor="#334155"
            style={{ backgroundColor: '#0b1220', borderColor: '#334155', borderWidth: 1, borderRadius: 10, padding: 10, color: '#f1f5f9' }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Token (placeholder)</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="(optional) bearer token"
            placeholderTextColor="#334155"
            style={{ backgroundColor: '#0b1220', borderColor: '#334155', borderWidth: 1, borderRadius: 10, padding: 10, color: '#f1f5f9' }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={loadOrders} style={{ backgroundColor: '#1e293b', borderRadius: 10, padding: 10, flex: 1 }}>
            <Text style={{ color: '#f1f5f9', textAlign: 'center', fontWeight: '700' }}>Load Orders</Text>
          </Pressable>
          <Pressable onPress={startTracking} style={{ backgroundColor: connected ? '#22c55e' : '#f97316', borderRadius: 10, padding: 10, flex: 1 }}>
            <Text style={{ color: '#0b1220', textAlign: 'center', fontWeight: '800' }}>{connected ? 'Tracking' : 'Start Tracking'}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={{ borderColor: '#334155', borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#0b1220' }}>
            <Text style={{ color: '#f1f5f9', fontWeight: '700' }}>{item.orderNumber}</Text>
            <Text style={{ color: '#94a3b8' }}>{item.status}</Text>
            {item.deliveryAddress ? <Text style={{ color: '#64748b', marginTop: 6 }}>{item.deliveryAddress}</Text> : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

