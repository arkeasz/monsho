"use client";

import { FormEvent, useState } from "react";
import { apiRequest } from "@/api/utils";

interface SignupResponse {
  message: string;
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = (formData.get("role") as "worker" | "admin") || "worker";

    try {
      const data = await apiRequest<SignupResponse>("signup/signup", {
        username,
        password,
        role,
      });
      setSuccess(data.message);
      form.reset();
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl mb-4">Crear Cuenta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-64">
        <input
          name="username"
          placeholder="Username"
          className="border p-2 rounded"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          required
        />
        <select name="role" className="border p-2 rounded">
          <option value="worker">Worker</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          {loading ? "Creando..." : "Crear Cuenta"}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {success && <p className="text-green-600 mt-2">{success}</p>}
      </form>
    </main>
  );
}