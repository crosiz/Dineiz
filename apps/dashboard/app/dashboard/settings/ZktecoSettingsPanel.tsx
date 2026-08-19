import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { PageLoader } from "@/components/ui/Spinner";

interface Device {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: string;
  lastSyncAt: string | null;
  branchId: string;
}

export function ZktecoSettingsPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", ipAddress: "", port: 4370, branchId: "" });
  const [branches, setBranches] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [devs, br] = await Promise.all([
        apiFetch<Device[]>("/api/zkteco/devices"),
        apiFetch<any[]>("/api/branches")
      ]);
      setDevices(devs);
      // Wait, standard route for branches might just be /api/branches, adjusting if needed.
      if (Array.isArray(br)) setBranches(br);
      else if (br && (br as any).data) setBranches((br as any).data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.branchId && branches.length > 0) {
      addForm.branchId = branches[0].id; // Fallback
    }
    try {
      const res = await apiFetch<any>("/api/zkteco/devices", {
        method: "POST",
        body: JSON.stringify(addForm)
      });
      alert(res.connected ? "Device added and connected successfully!" : "Device added but failed to connect. Check IP/Port.");
      setShowAddForm(false);
      loadData();
    } catch (e: any) {
      alert("Error adding device: " + e.message);
    }
  }

  async function handleTestConnection(id: string) {
    try {
      const res = await apiFetch<any>(`/api/zkteco/devices/${id}/test`, { method: "POST" });
      alert(res.connected ? "Connection successful!" : "Device is offline.");
      loadData();
    } catch (e: any) {
      alert("Error testing connection");
    }
  }

  async function handleSyncNow(id: string) {
    try {
      await apiFetch(`/api/zkteco/devices/${id}/sync`, { method: "POST" });
      alert("Sync completed.");
      loadData();
    } catch (e: any) {
      alert("Error syncing");
    }
  }

  async function handleEnrollStaff(id: string) {
    const userId = prompt("Enter the Staff ID to enroll:");
    if (!userId) return;
    try {
      const res = await apiFetch<any>(`/api/zkteco/devices/${id}/enroll`, {
        method: "POST",
        body: JSON.stringify({ userId })
      });
      alert(res.message || `Enrolled as ID ${res.zkUserId}`);
    } catch (e: any) {
      alert("Error enrolling staff: " + e.message);
    }
  }

  async function handleViewStaff(id: string) {
    try {
      const res = await apiFetch<any[]>(`/api/zkteco/devices/${id}/users`);
      alert(`Enrolled Users:\n${res.map(u => `${u.uid}: ${u.name}`).join("\n")}`);
    } catch (e: any) {
      alert("Error fetching users");
    }
  }

  if (loading) return <PageLoader label="Loading devices..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-text-muted text-sm">Configured attendance devices</p>
        <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg font-label-md">
          Add Device
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddDevice} className="p-4 bg-surface-container-lowest border border-border-subtle rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Device Name</label>
              <input required value={addForm.name} onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))} className="w-full p-2 border rounded" placeholder="Main Entrance" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Branch</label>
              <select required value={addForm.branchId} onChange={e => setAddForm(prev => ({ ...prev, branchId: e.target.value }))} className="w-full p-2 border rounded">
                <option value="">Select Branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IP Address</label>
              <input required value={addForm.ipAddress} onChange={e => setAddForm(prev => ({ ...prev, ipAddress: e.target.value }))} className="w-full p-2 border rounded" placeholder="192.168.1.201" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <input type="number" required value={addForm.port} onChange={e => setAddForm(prev => ({ ...prev, port: parseInt(e.target.value) }))} className="w-full p-2 border rounded" />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">Save & Connect</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {devices.map(device => (
          <div key={device.id} className="p-4 border border-border-subtle rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="font-semibold">{device.name}</h5>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${device.status === 'ONLINE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {device.status}
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">IP: {device.ipAddress}:{device.port}</p>
              <p className="text-xs text-text-muted mt-1">Last Sync: {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : 'Never'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleTestConnection(device.id)} className="px-3 py-1.5 text-sm border rounded hover:bg-surface-container">Test</button>
              <button onClick={() => handleSyncNow(device.id)} className="px-3 py-1.5 text-sm border rounded hover:bg-surface-container">Sync Now</button>
              <button onClick={() => handleViewStaff(device.id)} className="px-3 py-1.5 text-sm border rounded hover:bg-surface-container">View Staff</button>
              <button onClick={() => handleEnrollStaff(device.id)} className="px-3 py-1.5 text-sm bg-primary text-white rounded">Enroll Staff</button>
            </div>
          </div>
        ))}
        {devices.length === 0 && !loading && (
          <div className="text-center p-8 border border-dashed rounded-lg text-text-muted">
            No devices configured yet.
          </div>
        )}
      </div>
    </div>
  );
}
