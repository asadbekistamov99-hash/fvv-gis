import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

final mapStyleUrl = const String.fromEnvironment('MAP_STYLE_URL').isNotEmpty
    ? const String.fromEnvironment('MAP_STYLE_URL')
    : Uri.parse(apiBase).replace(path: '/tiles/style.json').toString();

Future<Position> currentPosition() async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw StateError('GPS o‘chirilgan. Qurilma sozlamalaridan yoqing.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw StateError('Joylashuvga ruxsat berilmadi. Joyni xaritadan tanlang.');
  }
  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 25),
    ),
  );
}

double distanceMeters(LatLng a, LatLng b) => Geolocator.distanceBetween(
  a.latitude,
  a.longitude,
  b.latitude,
  b.longitude,
);

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key, this.pickLocation});
  final void Function(LatLng)? pickLocation;
  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  MapLibreMapController? controller;
  final search = TextEditingController();
  bool loaded = false, busy = true, measure = false;
  String? error, region, category, status;
  List<Map<String, dynamic>> features = [];
  final List<LatLng> measurePoints = [];
  double measured = 0;
  int _request = 0, _drawGeneration = 0;
  Object get _identity {
    final state = ref.read(appProvider);
    return (
      state.account?.id,
      state.account?.policyEpoch,
      state.account?.isEmployee,
      state.offlineGrantValid,
      ref.read(apiProvider).sessionRevision,
    );
  }

  @override
  void initState() {
    super.initState();
    Future.microtask(load);
  }

  @override
  void dispose() {
    _request++;
    _drawGeneration++;
    search.dispose();
    controller?.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final request = ++_request;
    final identity = _identity;
    bool current() => mounted && request == _request && identity == _identity;
    final state = ref.read(appProvider);
    final employee = state.account?.isEmployee == true;
    setState(() {
      busy = true;
      error = null;
    });
    if (employee && !state.offlineGrantValid) {
      setState(() {
        features = [];
        busy = false;
        error = 'Operativ ma’lumot uchun ruxsatni yangilang.';
      });
      await draw();
      return;
    }
    try {
      final result = await ref.read(apiProvider).get(
        employee ? '/gis/objects' : '/public/gis/objects',
        {
          if (search.text.trim().isNotEmpty) 'q': search.text.trim(),
          if (region != null) 'region_id': region,
          if (category != null) 'category_id': category,
          if (status != null) 'status': status,
        },
      ) as Map;
      if (!current()) {
        return;
      }
      features = (result['features'] as List? ?? [])
          .map((value) => Map<String, dynamic>.from(value as Map))
          .toList();
      setState(() => busy = false);
      await draw();
    } catch (e) {
      if (!current()) {
        return;
      }
      if (employee && e is DioException && e.response == null) {
        try {
          final cached = await ref
              .read(appProvider.notifier)
              .store
              ?.readCache('infrastructure');
          if (!current()) {
            return;
          }
          if (cached != null) {
            final query = search.text.trim().toLowerCase();
            features = cached
                .where(
                  (row) =>
                      (region == null || row['region_id'] == region) &&
                      (category == null || row['category_id'] == category) &&
                      (status == null || row['operational_status'] == status) &&
                      (query.isEmpty ||
                          '${row['name']} ${row['code']}'
                              .toLowerCase()
                              .contains(query)),
                )
                .map(
                  (row) => <String, dynamic>{
                    'type': 'Feature',
                    'geometry': row['geometry'],
                    'properties': row,
                  },
                )
                .toList();
            setState(() => busy = false);
            await draw();
            return;
          }
        } catch (_) {}
      }
      if (!current()) {
        return;
      }
      setState(() {
        features = [];
        error = readableError(e);
        busy = false;
      });
      await draw();
    }
  }

  Future<void> draw() async {
    final generation = ++_drawGeneration;
    if (!loaded || controller == null) {
      return;
    }
    await controller!.clearCircles();
    await controller!.clearLines();
    await controller!.clearFills();
    for (final feature in List<Map<String, dynamic>>.of(features)) {
      if (generation != _drawGeneration || !mounted) {
        return;
      }
      final geometry = feature['geometry'] as Map?;
      if (geometry == null) continue;
      final properties = Map<String, dynamic>.from(
        feature['properties'] as Map? ?? {},
      );
      final color =
          '#${statusColor(properties['operational_status']?.toString() ?? 'unknown').toARGB32().toRadixString(16).substring(2)}';
      final coords = geometry['coordinates'];
      LatLng point(dynamic value) =>
          LatLng((value[1] as num).toDouble(), (value[0] as num).toDouble());
      try {
        if (geometry['type'] == 'Point') {
          await controller!.addCircle(
            CircleOptions(
              geometry: point(coords),
              circleColor: color,
              circleRadius: 10,
              circleStrokeColor: '#081320',
              circleStrokeWidth: 3,
            ),
            properties,
          );
        } else if (geometry['type'] == 'LineString') {
          await controller!.addLine(
            LineOptions(
              geometry: (coords as List).map(point).toList(),
              lineColor: color,
              lineWidth: 5,
            ),
            properties,
          );
        } else if (geometry['type'] == 'Polygon') {
          await controller!.addFill(
            FillOptions(
              geometry: (coords as List)
                  .map((ring) => (ring as List).map(point).toList())
                  .toList(),
              fillColor: color,
              fillOpacity: .3,
              fillOutlineColor: color,
            ),
            properties,
          );
        }
      } catch (e) {
        if (mounted) setState(() => error = readableError(e));
      }
    }
    if (generation == _drawGeneration && measurePoints.length > 1) {
      await controller!.addLine(
        LineOptions(
          geometry: measurePoints,
          lineColor: '#ffffff',
          lineWidth: 3,
        ),
      );
    }
  }

  void select(Map<String, dynamic> properties) {
    final t = L10n(ref.read(appProvider).locale);
    final employee = ref.read(appProvider).account?.isEmployee == true;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                properties['name']?.toString() ?? '—',
                style: Theme.of(context).textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  StatusPill(
                    properties['operational_status']?.toString() ?? 'unknown',
                    t: t,
                  ),
                  if (properties['is_synthetic'] == true)
                    Chip(label: Text(t('synthetic'))),
                ],
              ),
              if (properties['updated_at'] != null)
                DataRowView(t('updated'), properties['updated_at']),
              if (employee) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    context.push('/objects/${properties['id']}');
                  },
                  icon: const Icon(Icons.description_outlined),
                  label: Text(t('technicalPassport')),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> locate() async {
    try {
      final position = await currentPosition();
      await controller?.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(position.latitude, position.longitude),
          15,
        ),
      );
      if (mounted) {
        showMessage(
          context,
          '${L10n(ref.read(appProvider).locale)('accuracy')}: ±${position.accuracy.toStringAsFixed(1)} m',
        );
      }
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
    }
  }

  Future<void> filters() async {
    final t = L10n(ref.read(appProvider).locale);
    final categories = ref.read(categoriesProvider).asData?.value ?? [];
    final regions = ref.read(regionsProvider).asData?.value ?? [];
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  t('layers'),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 20),
                DropdownButtonFormField<String>(
                  initialValue: region ?? '',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: t('region')),
                  items: [
                    DropdownMenuItem(value: '', child: Text(t('all'))),
                    ...regions.map(
                      (e) => DropdownMenuItem(
                        value: e['id'].toString(),
                        child: Text((e['name_uz'] ?? e['name']).toString()),
                      ),
                    ),
                  ],
                  onChanged: (v) => setSheet(() => region = v == '' ? null : v),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: category ?? '',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: t('category')),
                  items: [
                    DropdownMenuItem(value: '', child: Text(t('all'))),
                    ...categories.map(
                      (e) => DropdownMenuItem(
                        value: e['id'].toString(),
                        child: Text((e['name_uz'] ?? e['name']).toString()),
                      ),
                    ),
                  ],
                  onChanged: (v) =>
                      setSheet(() => category = v == '' ? null : v),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: status ?? '',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: t('status')),
                  items: [
                    DropdownMenuItem(value: '', child: Text(t('all'))),
                    ...[
                      'working',
                      'faulty',
                      'under_maintenance',
                      'temporarily_unavailable',
                      'not_inspected',
                      'unknown',
                    ].map((e) => DropdownMenuItem(value: e, child: Text(t(e)))),
                  ],
                  onChanged: (v) => setSheet(() => status = v == '' ? null : v),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(t('verify')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (mounted) await load();
  }

  @override
  Widget build(BuildContext context) {
    final t = L10n(ref.watch(appProvider).locale);
    ref.listen(
      appProvider.select(
        (state) => (
          state.account?.id,
          state.account?.policyEpoch,
          state.account?.isEmployee,
          state.offlineGrantValid,
        ),
      ),
      (previous, next) {
        if (previous != next) {
          features = [];
          draw();
          Future.microtask(load);
        }
      },
    );
    ref.watch(categoriesProvider);
    ref.watch(regionsProvider);
    return Stack(
      children: [
        MapLibreMap(
          styleString: mapStyleUrl,
          initialCameraPosition: const CameraPosition(
            target: LatLng(41.2, 64.6),
            zoom: 5,
          ),
          minMaxZoomPreference: const MinMaxZoomPreference(4, 19),
          trackCameraPosition: true,
          compassEnabled: true,
          myLocationEnabled: false,
          onMapCreated: (value) {
            controller = value;
            value.onCircleTapped.add(
              (circle) => select(Map<String, dynamic>.from(circle.data ?? {})),
            );
            value.onLineTapped.add(
              (line) => select(Map<String, dynamic>.from(line.data ?? {})),
            );
            value.onFillTapped.add(
              (fill) => select(Map<String, dynamic>.from(fill.data ?? {})),
            );
          },
          onStyleLoadedCallback: () {
            loaded = true;
            draw();
          },
          onMapClick: (math.Point<double> point, LatLng coordinate) {
            if (widget.pickLocation != null) {
              widget.pickLocation!(coordinate);
              return;
            }
            if (measure) {
              setState(() {
                if (measurePoints.isNotEmpty) {
                  measured += distanceMeters(measurePoints.last, coordinate);
                }
                measurePoints.add(coordinate);
              });
              draw();
            }
          },
        ),
        Positioned(
          top: 14,
          left: 14,
          right: 14,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(16),
            child: TextField(
              controller: search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => load(),
              decoration: InputDecoration(
                hintText: t('search'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: filters,
                  tooltip: t('layers'),
                  icon: const Icon(Icons.tune),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          right: 14,
          bottom: 110,
          child: Column(
            children: [
              FloatingActionButton(
                heroTag: 'gps',
                tooltip: t('gps'),
                onPressed: locate,
                child: const Icon(Icons.my_location),
              ),
              const SizedBox(height: 12),
              FloatingActionButton(
                heroTag: 'measure',
                tooltip: t('measure'),
                backgroundColor: measure
                    ? Theme.of(context).colorScheme.tertiaryContainer
                    : null,
                onPressed: () {
                  setState(() {
                    measure = !measure;
                    measurePoints.clear();
                    measured = 0;
                  });
                  draw();
                },
                child: const Icon(Icons.straighten),
              ),
              const SizedBox(height: 12),
              FloatingActionButton(
                heroTag: 'refresh',
                tooltip: t('refresh'),
                onPressed: load,
                child: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        Positioned(
          bottom: 14,
          left: 14,
          right: 84,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    measure
                        ? '${t('measure')}: ${measured < 1000 ? '${measured.toStringAsFixed(0)} m' : '${(measured / 1000).toStringAsFixed(2)} km'}'
                        : '${features.length} · ${t(ref.watch(appProvider).account?.isEmployee == true ? 'operationalMap' : 'publicMap')}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '© OpenStreetMap contributors · ODbL',
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (busy)
          const Positioned(
            top: 88,
            left: 20,
            right: 20,
            child: LinearProgressIndicator(),
          ),
        if (error != null)
          Positioned(
            top: 90,
            left: 16,
            right: 16,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(error!),
              ),
            ),
          ),
      ],
    );
  }
}
