/**
 * VenuePickerModal - full-screen modal listing company venues for selection.
 * Fed from GET /api/v1/venues/ — backend scopes to the caller's company.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../../../../services/api';
import { API_ENDPOINTS } from '../../../../config/api.config';
import { useTheme } from '../../../../hooks/useTheme';
import { getUberColors, uberRadius, uberSpacing } from '../../../../theme/uberTheme';
import { logger } from '../../../../utils/logger';

export interface VenuePickerOption {
  id: number;
  name: string;
  address: string;
}

interface PaginatedVenues {
  count?: number;
  next?: string | null;
  results?: VenuePickerOption[];
}

interface VenuePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (venue: VenuePickerOption) => void;
  selectedId?: number;
}

export const VenuePickerModal: React.FC<VenuePickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedId,
}) => {
  const { isDark } = useTheme();
  const colors = getUberColors(isDark);

  const [venues, setVenues] = useState<VenuePickerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiService.get<PaginatedVenues | VenuePickerOption[]>(
          `${API_ENDPOINTS.VENUES.LIST}?page_size=100`
        );
        const list = Array.isArray(data) ? data : data?.results ?? [];
        if (!cancelled) {
          setVenues(list);
        }
      } catch (err: any) {
        logger.error('[VenuePicker] failed to load venues', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load venues');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter(
      (v) => v.name.toLowerCase().includes(q) || (v.address || '').toLowerCase().includes(q)
    );
  }, [venues, search]);

  const renderItem = ({ item }: { item: VenuePickerOption }) => {
    const active = item.id === selectedId;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: active ? `${colors.primary}15` : colors.background.light,
            borderColor: active ? colors.primary : colors.border.light,
          },
        ]}
        onPress={() => {
          onSelect(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {!!item.address && (
            <Text style={[styles.meta, { color: colors.text.secondary }]} numberOfLines={1}>
              {item.address}
            </Text>
          )}
        </View>
        {active && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.light }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.background.surface, borderBottomColor: colors.border.light },
          ]}
        >
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text.primary }]}>Select venue</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.background.surface }]}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search by name or address"
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>

        {isLoading && venues.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={{ color: colors.text.secondary }}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerBox}>
                <Text style={{ color: colors.text.secondary }}>No venues found.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.sm,
    marginHorizontal: uberSpacing.base,
    marginTop: uberSpacing.md,
    paddingHorizontal: uberSpacing.md,
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.md,
  },
  searchInput: { flex: 1, fontSize: 14 },
  listContent: {
    flexGrow: 1,
    padding: uberSpacing.base,
    gap: uberSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.md,
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.md,
    borderRadius: uberRadius.md,
    borderWidth: 1,
    marginBottom: uberSpacing.sm,
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: uberSpacing.xl,
  },
});
