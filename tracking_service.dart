import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'location_service.dart';

class TrackingService {
  static final _supabase = Supabase.instance.client;
  static StreamSubscription<Position>? _sub;
  static bool _ativo = false;

  /// Inicia envio de GPS para o Supabase
  static Future<void> iniciar(String entregadorId) async {
    if (_ativo) return;
    _ativo = true;

    _sub = LocationService.getPositionStream().listen((pos) async {
      try {
        await _supabase.from('entregadores').update({
          'lat': pos.latitude,
          'lng': pos.longitude,
          'latitude': pos.latitude,
          'longitude': pos.longitude,
          'disponivel': true,
          'status': 'ocupado',
          'updated_at': DateTime.now().toIso8601String(),
        }).eq('id', entregadorId);
      } catch (_) {}
    });
  }

  /// Para o envio de GPS (usado ao finalizar entrega — mantém entregador online/disponível)
  static Future<void> parar(String entregadorId) async {
    _ativo = false;
    await _sub?.cancel();
    _sub = null;
    try {
      await _supabase.from('entregadores').update({
        'status': 'disponivel',
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', entregadorId);
    } catch (_) {}
  }

  /// Marca motoboy como online/disponível e inicia envio de localização
  static Future<void> ficarOnline(String entregadorId) async {
    final pos = await LocationService.getCurrentPosition();
    try {
      await _supabase.from('entregadores').update({
        'disponivel': true,
        'status': 'disponivel',
        'lat': pos?.latitude,
        'lng': pos?.longitude,
        'latitude': pos?.latitude,
        'longitude': pos?.longitude,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', entregadorId);
    } catch (_) {}
  }

  /// Tenta marcar motoboy como offline.
  ///
  /// Lança [Exception] se houver pedido ativo (aceito / chegou_local /
  /// em_rota / retornando) associado ao entregador — o chamador deve capturar
  /// e exibir [exception.message] ao usuário.
  ///
  /// Em caso de sucesso: para o stream de GPS e remove as coordenadas do
  /// Supabase para que o marcador desapareça do mapa do painel.
  static Future<void> ficarOffline(String entregadorId) async {
    // Verifica pedidos ativos vinculados ao entregador
    final ativos = await _supabase
        .from('pedidos')
        .select('id')
        .eq('motoboy_id', entregadorId)
        .inFilter('status', ['aceito', 'chegou_local', 'em_rota', 'retornando']);

    if (ativos.isNotEmpty) {
      throw Exception(
        'Você possui uma entrega em andamento. '
        'Finalize a entrega antes de ficar offline.',
      );
    }

    // Para stream de GPS
    _ativo = false;
    await _sub?.cancel();
    _sub = null;

    // Marca offline e limpa coordenadas para remover marcador do mapa
    try {
      await _supabase.from('entregadores').update({
        'disponivel': false,
        'status': 'offline',
        'lat': null,
        'lng': null,
        'latitude': null,
        'longitude': null,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', entregadorId);
    } catch (_) {}
  }

  static bool get ativo => _ativo;
}
