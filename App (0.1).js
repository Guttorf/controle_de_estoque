import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@inventory_products_v1';

// Função para exibir alerta compatível com web e mobile (Snack/devices)
function showAlert(title, message, onConfirm = null) {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed && onConfirm) {
      onConfirm();
    }
  } else {
    const buttons = onConfirm
      ? [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: onConfirm }
        ]
      : [{ text: 'OK' }];
    Alert.alert(title, message, buttons);
  }
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const categories = [
    'Hortifruti','Açougue','Laticínios','Padaria','Bebidas',
    'Limpeza','Higiene','Mercearia','Congelados','Outros'
  ];

  // Carregar produtos do AsyncStorage ao iniciar
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          setProducts(JSON.parse(json));
        }
      } catch (e) {
        console.log('Erro ao carregar produtos:', e);
      }
    })();
  }, []);

  // Salvar sempre que products mudar
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      } catch (e) {
        console.log('Erro ao salvar produtos:', e);
      }
    })();
  }, [products]);

  // Helpers de data
  function normalizeDateString(dateStr) {
    if (!dateStr) return null;
    dateStr = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const slashDMY = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
    if (slashDMY) {
      const [, d, m, y] = slashDMY;
      return `${y}-${m}-${d}`;
    }
    const slashYMD = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(dateStr);
    if (slashYMD) {
      const [, y, m, d] = slashYMD;
      return `${y}-${m}-${d}`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  function isProductExpired(expiry) {
    if (!expiry) return false;
    const norm = normalizeDateString(expiry);
    if (!norm) return false;
    const expiryDateObj = new Date(norm);
    if (isNaN(expiryDateObj.getTime())) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    expiryDateObj.setHours(0,0,0,0);
    return expiryDateObj < today;
  }

  function formatDate(dateString) {
    if (!dateString) return 'Sem validade';
    const norm = normalizeDateString(dateString);
    if (!norm) return 'Data inválida';
    const d = new Date(norm + 'T00:00:00'); 
    if (isNaN(d.getTime())) return 'Data inválida';
    return d.toLocaleDateString('pt-BR');
  }

  const totalInventoryValue = products.reduce((total, product) => {
    const p = Number(product.price) || 0;
    const q = Number(product.quantity) || 0;
    return total + p * q;
  }, 0);

  const filteredProducts = products.filter(product => {
    const expiry = normalizeDateString(product.expiryDate);
    const expired = expiry ? isProductExpired(expiry) : false;

    const searchLower = search.trim().toLowerCase();
    const matchesSearch = !searchLower || (
      String(product.name).toLowerCase().includes(searchLower) ||
      String(product.category || '').toLowerCase().includes(searchLower)
    );

    switch (filter) {
      case 'inStock':
        return product.quantity > 0 && !expired && matchesSearch;
      case 'outOfStock':
        return Number(product.quantity) === 0 && matchesSearch;
      case 'expired':
        return expired && matchesSearch;
      default:
        return matchesSearch;
    }
  });

  function addOrUpdateProduct() {
    if (!name.trim()) {
      showAlert('Erro', 'Digite o nome do produto');
      return;
    }

    const qty = parseInt(quantity) || 0;
    const productPrice = parseFloat(String(price).replace(',', '.')) || 0;
    const productWeight = parseFloat(String(weight).replace(',', '.')) || 0;
    const normExpiry = normalizeDateString(expiryDate);

    if (editingId !== null) {
      setProducts(products.map(p =>
        p.id === editingId ?
          { 
            ...p, 
            name,
            quantity: qty,
            price: productPrice,
            weight: productWeight,
            expiryDate: normExpiry,
            category: category || 'Outros'
          }
          : p
      ));
      setEditingId(null);
    } else {
      const newProduct = {
        id: Date.now(),
        name,
        quantity: qty,
        price: productPrice,
        weight: productWeight,
        expiryDate: normExpiry,
        category: category || 'Outros'
      };
      setProducts([newProduct, ...products]);
    }

    // Limpar formulário
    setName('');
    setQuantity('');
    setPrice('');
    setWeight('');
    setExpiryDate('');
    setCategory('');
    setModalVisible(false);
  }

  function editProduct(product) {
    setName(product.name ?? '');
    setQuantity(String(product.quantity ?? ''));
    setPrice(String(product.price ?? ''));
    setWeight(String(product.weight ?? ''));
    setExpiryDate(product.expiryDate ?? '');
    setCategory(product.category ?? '');
    setEditingId(product.id);
    setModalVisible(true);
  }

  function deleteProduct(id) {
    showAlert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este produto?',
      () => {
        setProducts(products.filter(p => p.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setModalVisible(false);
        }
      }
    );
  }

  function adjustQuantity(id, delta) {
    setProducts(products.map(p =>
      p.id === id
        ? { ...p, quantity: Math.max(0, Number(p.quantity || 0) + delta) }
        : p
    ));
  }

  function getStatusColor(product) {
    if (!product.expiryDate) return '#10b981';
    if (isProductExpired(product.expiryDate)) return '#ef4444';
    if (product.quantity === 0) return '#ef4444';
    const today = new Date();
    const expiry = new Date(normalizeDateString(product.expiryDate));
    if (isNaN(expiry.getTime())) return '#6b7280';
    expiry.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 7) return '#fbbf24';
    return '#10b981';
  }

  const renderItem = ({ item }) => (
    <View style={[styles.item, { borderLeftColor: getStatusColor(item), borderLeftWidth: 4 }]}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
      </View>

      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Quantidade:</Text>
          <Text style={styles.detailValue}>
            {Number(item.quantity) === 0 ? '❌ Em falta' : `${item.quantity} unidades`}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Preço:</Text>
          <Text style={styles.detailValue}>R$ {(Number(item.price) || 0).toFixed(2).replace('.', ',')}</Text>
        </View>

        {Number(item.weight) > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Peso:</Text>
            <Text style={styles.detailValue}>{item.weight} kg</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Validade:</Text>
          <Text style={[
            styles.detailValue,
            isProductExpired(item.expiryDate) && styles.expiredText
          ]}>
            {formatDate(item.expiryDate)}
            {isProductExpired(item.expiryDate) && ' ⚠️'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Valor Total:</Text>
          <Text style={styles.detailValue}>
            R$ {((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityBtn}
            onPress={() => adjustQuantity(item.id, -1)}
          >
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quantityBtn}
            onPress={() => adjustQuantity(item.id, 1)}
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.btnEdit}
          onPress={() => editProduct(item)}
        >
          <Text style={styles.btnText}>✏️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnDelete}
          onPress={() => deleteProduct(item.id)}
        >
          <Text style={styles.btnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📦 Controle de Estoque</Text>
        <Text style={styles.subtitle}>Gerencie seus produtos</Text>
      </View>

      {/* Pesquisa */}
      <View style={{ padding: 12 }}>
        <TextInput
          placeholder="Buscar por nome ou categoria..."
          value={search}
          onChangeText={setSearch}
          style={[styles.input, { backgroundColor: '#fff' }]}
        />
      </View>

      {/* Estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Produtos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {products.filter(p => Number(p.quantity) > 0).length}
          </Text>
          <Text style={styles.statLabel}>Em estoque</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.statValue]}>
            R$ {totalInventoryValue.toFixed(2).replace('.', ',')}
          </Text>
          <Text style={styles.statLabel}>Valor total</Text>
        </View>
      </View>

      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'inStock' && styles.filterBtnActive]}
          onPress={() => setFilter('inStock')}
        >
          <Text style={[styles.filterText, filter === 'inStock' && styles.filterTextActive]}>
            Em estoque
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'outOfStock' && styles.filterBtnActive]}
          onPress={() => setFilter('outOfStock')}
        >
          <Text style={[styles.filterText, filter === 'outOfStock' && styles.filterTextActive]}>
            Em falta
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'expired' && styles.filterBtnActive]}
          onPress={() => setFilter('expired')}
        >
          <Text style={[styles.filterText, filter === 'expired' && styles.filterTextActive]}>
            Vencidos
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Botão Adicionar Produto */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setEditingId(null);
          setName('');
          setQuantity('');
          setPrice('');
          setWeight('');
          setExpiryDate('');
          setCategory('');
          setModalVisible(true);
        }}
      >
        <Text style={styles.addButtonText}>+ Adicionar Produto</Text>
      </TouchableOpacity>

      {/* Lista de Produtos */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>📦</Text>
            <Text style={styles.emptyStateText}>Nenhum produto cadastrado</Text>
            <Text style={styles.emptyStateSubtext}>
              Clique em "Adicionar Produto" para começar
            </Text>
          </View>
        }
      />

      {/* Modal de Adicionar/Editar */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Editar Produto' : 'Adicionar Produto'}
            </Text>

            <ScrollView style={styles.modalForm}>
              <TextInput
                style={styles.input}
                placeholder="Nome do produto*"
                value={name}
                onChangeText={setName}
              />

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Quantidade"
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />

                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Preço (ex: 10.50)"
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Peso em kg (opcional)"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />

                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Validade (AAAA-MM-DD ou DD/MM/AAAA)"
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                />
              </View>

              <Text style={styles.label}>Categoria</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryContainer}
              >
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryBtn, category === cat && styles.categoryBtnActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addOrUpdateProduct}
              >
                <Text style={styles.saveButtonText}>
                  {editingId ? 'Salvar' : 'Adicionar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  header: { 
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center',
    color: '#1e293b'
  },
  subtitle: { 
    fontSize: 14, 
    textAlign: 'center',
    color: '#64748b',
    marginTop: 4
  },
  statsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around',
    padding: 16
  },
  statCard: { 
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    elevation: 2
  },
  statNumber: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#1e293b'
  },
  statValue: {
    fontSize: 14
  },
  statLabel: { 
    fontSize: 10, 
    color: '#64748b',
    marginTop: 4
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6'
  },
  filterText: {
    color: '#64748b',
    fontSize: 12
  },
  filterTextActive: {
    color: '#fff'
  },
  addButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 3
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  list: {
    flex: 1,
    paddingHorizontal: 16
  },
  item: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1
  },
  itemCategory: {
    fontSize: 10,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  itemDetails: {
    marginBottom: 8
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b'
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b'
  },
  expiredText: {
    color: '#ef4444',
    fontWeight: 'bold'
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  quantityControls: {
    flexDirection: 'row'
  },
  quantityBtn: {
    backgroundColor: '#6b7280',
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  btnEdit: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6
  },
  btnDelete: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '500'
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1e293b',
    textAlign: 'center'
  },
  modalForm: {
    maxHeight: 300
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  halfInput: {
    width: '48%'
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6
  },
  categoryContainer: {
    marginBottom: 12
  },
  categoryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6'
  },
  categoryText: {
    fontSize: 10,
    color: '#6b7280'
  },
  categoryTextActive: {
    color: '#fff'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8
  },
  cancelButton: {
    backgroundColor: '#f3f4f6'
  },
  saveButton: {
    backgroundColor: '#10b981'
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '500'
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '500'
  }
});
